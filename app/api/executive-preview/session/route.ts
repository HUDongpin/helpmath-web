import {NextRequest, NextResponse} from 'next/server';

import {
  EXECUTIVE_PREVIEW_COOKIE_NAME,
  EXECUTIVE_PREVIEW_SESSION_TTL_SECONDS,
  createExecutivePreviewSession,
  getExecutivePreviewConfig,
  getExecutivePreviewReturnTo,
  verifyExecutivePreviewAccessKey,
} from '@/lib/executive-preview-access';
import {
  ExecutivePreviewFailureLimiter,
  getExecutivePreviewClientIdentifier,
} from '@/lib/executive-preview-rate-limit';

const MAX_FORM_BYTES = 4 * 1024;
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;
const failureLimiter = new ExecutivePreviewFailureLimiter();

function entryPath(locale: 'en' | 'es'): string {
  return locale === 'es' ? '/es/executive-preview' : '/executive-preview';
}

function redirectResponse(pathname: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {...PRIVATE_HEADERS, Location: pathname},
  });
}

function errorResponse(status: number, code: string, headers: HeadersInit = {}) {
  return NextResponse.json(
    {ok: false, error: {code}},
    {status, headers: {...PRIVATE_HEADERS, ...headers}},
  );
}

function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin') return false;

  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.origin === request.nextUrl.origin) return true;

    // Next.js may normalize request.nextUrl to localhost behind a local or
    // platform proxy. Compare the browser origin with the actual forwarded
    // request authority as a strict fallback.
    const forwardedHost = request.headers.get('x-forwarded-host')
      ?.split(',', 1)[0]
      ?.trim() || request.headers.get('host')?.trim();
    const forwardedProtocol = request.headers.get('x-forwarded-proto')
      ?.split(',', 1)[0]
      ?.trim() || request.nextUrl.protocol.replace(/:$/u, '');

    return Boolean(
      forwardedHost &&
      (forwardedProtocol === 'http' || forwardedProtocol === 'https') &&
      parsedOrigin.host === forwardedHost &&
      parsedOrigin.protocol === `${forwardedProtocol}:`,
    );
  } catch {
    return false;
  }
}

function isSecureRequest(request: NextRequest): boolean {
  const forwardedProtocol = request.headers.get('x-forwarded-proto')
    ?.split(',', 1)[0]
    ?.trim()
    .toLowerCase();

  return request.nextUrl.protocol === 'https:' || forwardedProtocol === 'https';
}

async function boundedForm(request: NextRequest): Promise<URLSearchParams> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/x-www-form-urlencoded') {
    throw new Error('unsupported-media-type');
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FORM_BYTES) {
    throw new Error('payload-too-large');
  }
  if (!request.body) return new URLSearchParams();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_FORM_BYTES) {
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

  return new URLSearchParams(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return errorResponse(403, 'EXECUTIVE_PREVIEW_FORBIDDEN');

  let form: URLSearchParams;
  try {
    form = await boundedForm(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason === 'unsupported-media-type') {
      return errorResponse(415, 'EXECUTIVE_PREVIEW_UNSUPPORTED_MEDIA_TYPE');
    }
    if (reason === 'payload-too-large') {
      return errorResponse(413, 'EXECUTIVE_PREVIEW_PAYLOAD_TOO_LARGE');
    }
    return errorResponse(400, 'EXECUTIVE_PREVIEW_BAD_REQUEST');
  }

  const locale = form.get('locale') === 'es' ? 'es' : 'en';
  if (form.get('action') === 'logout') {
    const response = redirectResponse(entryPath(locale));
    response.cookies.set(EXECUTIVE_PREVIEW_COOKIE_NAME, '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
      secure: isSecureRequest(request),
    });
    return response;
  }

  const config = getExecutivePreviewConfig();
  const returnTo = getExecutivePreviewReturnTo(form.get('returnTo'), locale);
  const accessKey = form.get('passphrase') ?? '';
  const client = getExecutivePreviewClientIdentifier(request.headers);
  const currentLimit = failureLimiter.check(client);
  if (currentLimit.blocked) {
    return errorResponse(429, 'EXECUTIVE_PREVIEW_RATE_LIMITED', {
      'Retry-After': String(currentLimit.retryAfterSeconds),
    });
  }
  const accessGranted = config
    ? await verifyExecutivePreviewAccessKey(accessKey, config)
    : false;

  if (!config || !accessGranted) {
    const nextLimit = failureLimiter.recordFailure(client);
    if (nextLimit.blocked) {
      return errorResponse(429, 'EXECUTIVE_PREVIEW_RATE_LIMITED', {
        'Retry-After': String(nextLimit.retryAfterSeconds),
      });
    }
    const failure = new URLSearchParams({error: '1'});
    if (returnTo !== entryPath(locale)) failure.set('returnTo', returnTo);
    return redirectResponse(`${entryPath(locale)}?${failure.toString()}`);
  }

  failureLimiter.clear(client);
  const now = Date.now();
  const session = await createExecutivePreviewSession(config, now);
  const maxAge = Math.max(
    1,
    Math.min(
      EXECUTIVE_PREVIEW_SESSION_TTL_SECONDS,
      Math.floor((config.expiresAt - now) / 1_000),
    ),
  );
  const response = redirectResponse(returnTo);
  response.cookies.set(EXECUTIVE_PREVIEW_COOKIE_NAME, session, {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: isSecureRequest(request),
  });
  return response;
}
