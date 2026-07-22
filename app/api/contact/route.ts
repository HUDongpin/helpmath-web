import {NextResponse} from 'next/server';
import {Resend} from 'resend';
import {contactRequestSchema, type ContactRequest} from '@/lib/contact-schema';
import {
  areContactManifestGatesApproved,
  isContactIntakeEnabled,
} from '@/lib/launch-gates';
import {isLegalCopyReady} from '@/lib/legal-copy-readiness';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_CONTACT_BODY_BYTES = 16 * 1024;
export const DEVELOPMENT_TURNSTILE_TOKEN = 'development-bypass';

type ErrorCode =
  | 'CONTACT_DISABLED'
  | 'CONTACT_FORBIDDEN'
  | 'BAD_REQUEST'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'TURNSTILE_NOT_CONFIGURED'
  | 'TURNSTILE_FAILED'
  | 'EMAIL_NOT_CONFIGURED'
  | 'DELIVERY_FAILED';

interface ErrorBody {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

interface SuccessBody {
  ok: true;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  const body: ErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(fieldErrors ? {fieldErrors} : {}),
    },
  };

  return NextResponse.json(body, {status, headers: NO_STORE_HEADERS});
}

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || undefined;
}

function parseOrigin(value: string | null) {
  const candidate = value?.trim();
  if (!candidate || candidate.toLowerCase() === 'null') return undefined;

  try {
    const parsed = new URL(candidate);
    if (
      parsed.origin === 'null' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function forwardedOrigin(request: Request) {
  const host = request.headers.get('x-forwarded-host')?.split(',', 1)[0]?.trim();
  const protocol = request.headers.get('x-forwarded-proto')?.split(',', 1)[0]
    ?.trim()
    .toLowerCase();
  if (!host || (protocol !== 'http' && protocol !== 'https')) return undefined;

  try {
    const parsed = new URL(`${protocol}://${host}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      parsed.host.toLowerCase() !== host.toLowerCase()
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function isSameOriginMutation(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null && fetchSite.trim().toLowerCase() !== 'same-origin') {
    return false;
  }

  const suppliedOrigin = parseOrigin(request.headers.get('origin'));
  if (!suppliedOrigin) return false;

  let requestOrigin: string;
  try {
    const requestUrl = new URL(request.url);
    if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return false;
    requestOrigin = requestUrl.origin;
  } catch {
    return false;
  }

  return suppliedOrigin === requestOrigin || suppliedOrigin === forwardedOrigin(request);
}

interface TurnstileResult {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

function hostname(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  try {
    return new URL(candidate.includes('://') ? candidate : `https://${candidate}`).hostname
      .toLowerCase();
  } catch {
    return undefined;
  }
}

function allowedTurnstileHostnames() {
  const configured = process.env.TURNSTILE_ALLOWED_HOSTNAMES?.split(',') ?? [];
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.helpmath.ai',
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...configured,
  ];
  const allowed = new Set(candidates.map(hostname).filter((value): value is string => Boolean(value)));

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('localhost');
    allowed.add('127.0.0.1');
  }

  return allowed;
}

async function boundedBodyText(request: Request) {
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_CONTACT_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error('payload-too-large');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string | undefined,
): Promise<'verified' | 'not-configured' | 'failed'> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    if (process.env.NODE_ENV !== 'production' && token === DEVELOPMENT_TURNSTILE_TOKEN) {
      return 'verified';
    }

    return 'not-configured';
  }

  try {
    const body = new URLSearchParams({secret, response: token});
    if (remoteIp) body.set('remoteip', remoteIp);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return 'failed';
    const result = (await response.json()) as TurnstileResult;
    const challengeHostname = hostname(result.hostname);
    return result.success === true &&
      result.action === 'contact' &&
      challengeHostname !== undefined &&
      allowedTurnstileHostnames().has(challengeHostname)
      ? 'verified'
      : 'failed';
  } catch {
    return 'failed';
  }
}

async function contactJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') throw new Error('unsupported-media-type');

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTACT_BODY_BYTES) {
    throw new Error('payload-too-large');
  }

  const raw = await boundedBodyText(request);
  return JSON.parse(raw) as unknown;
}

function emailText(payload: ContactRequest) {
  return [
    'HELP Math website contact request',
    '',
    `Locale: ${payload.locale}`,
    `Role: ${payload.role}`,
    `Topic: ${payload.topic}`,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Organization: ${payload.organization || 'Not provided'}`,
    '',
    'Message:',
    payload.message,
    '',
    'The sender affirmed the contact-form privacy statement.',
  ].join('\n');
}

export function buildContactEmail(payload: ContactRequest, from: string, to: string) {
  return {
    from,
    to: [to],
    replyTo: payload.email,
    subject: `HELP Math: ${payload.topic}`,
    text: emailText(payload),
  };
}

export async function handleContactRequest(
  request: Request,
  {repositoryGateApproved}: {repositoryGateApproved: boolean},
) {
  if (!isContactIntakeEnabled(process.env.NEXT_PUBLIC_CONTACT_ENABLED, repositoryGateApproved)) {
    return errorResponse(503, 'CONTACT_DISABLED', 'Contact intake is not enabled.');
  }

  if (!isSameOriginMutation(request)) {
    return errorResponse(403, 'CONTACT_FORBIDDEN', 'The request origin is not allowed.');
  }

  let body: unknown;
  try {
    body = await contactJson(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'unsupported-media-type') {
      return errorResponse(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'The request body must use application/json.',
      );
    }
    if (error instanceof Error && error.message === 'payload-too-large') {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
    }
    return errorResponse(400, 'BAD_REQUEST', 'The request body must be valid JSON.');
  }

  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).filter(
        (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0,
      ),
    );
    return errorResponse(
      422,
      'VALIDATION_ERROR',
      'One or more fields are invalid.',
      fieldErrors,
    );
  }

  // Do not reveal the trap to bots and do not verify or deliver their content.
  if (parsed.data.website) {
    const body: SuccessBody = {ok: true};
    return NextResponse.json(body, {headers: NO_STORE_HEADERS});
  }

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, clientIp(request));
  if (turnstile === 'not-configured') {
    return errorResponse(
      503,
      'TURNSTILE_NOT_CONFIGURED',
      'Spam protection is not configured.',
    );
  }
  if (turnstile === 'failed') {
    return errorResponse(422, 'TURNSTILE_FAILED', 'Spam-protection verification failed.');
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.SUPPORT_TO_EMAIL?.trim();
  const from = process.env.SUPPORT_FROM_EMAIL?.trim();
  if (!apiKey || !to || !from) {
    return errorResponse(503, 'EMAIL_NOT_CONFIGURED', 'Message delivery is not configured.');
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send(buildContactEmail(parsed.data, from, to));

    if (result.error) {
      return errorResponse(502, 'DELIVERY_FAILED', 'The message could not be delivered.');
    }
  } catch {
    return errorResponse(502, 'DELIVERY_FAILED', 'The message could not be delivered.');
  }

  const success: SuccessBody = {ok: true};
  return NextResponse.json(success, {headers: NO_STORE_HEADERS});
}

export async function POST(request: Request) {
  return handleContactRequest(request, {
    repositoryGateApproved:
      areContactManifestGatesApproved() && isLegalCopyReady(),
  });
}
