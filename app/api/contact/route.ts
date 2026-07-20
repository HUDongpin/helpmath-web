import {NextResponse} from 'next/server';
import {Resend} from 'resend';
import {contactRequestSchema, type ContactRequest} from '@/lib/contact-schema';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const DEVELOPMENT_TURNSTILE_TOKEN = 'development-bypass';

type ErrorCode =
  | 'BAD_REQUEST'
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

  return NextResponse.json(body, {status});
}

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || undefined;
}

interface TurnstileResult {
  success?: boolean;
  action?: string;
  'error-codes'?: string[];
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
    return result.success === true && result.action === 'contact' ? 'verified' : 'failed';
  } catch {
    return 'failed';
  }
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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
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
    return NextResponse.json(body);
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
  return NextResponse.json(success);
}
