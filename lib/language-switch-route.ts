import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

import {localizeHref, stripLocalePrefix} from '@/i18n/href';

const LANGUAGE_SWITCH_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Referer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;
const SAFE_LANGUAGE_PATH = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/u;

function normalizeLocalPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) return null;

  try {
    const parsed = new URL(value, 'https://local.helpmath.invalid');
    if (
      parsed.origin !== 'https://local.helpmath.invalid' ||
      !SAFE_LANGUAGE_PATH.test(parsed.pathname)
    ) return null;
    const localPathname = stripLocalePrefix(parsed.pathname);
    return SAFE_LANGUAGE_PATH.test(localPathname) ? localPathname : null;
  } catch {
    return null;
  }
}

function noContent(status: 400 | 404 | 405, allow?: string): NextResponse {
  return new NextResponse(null, {
    status,
    headers: {
      ...LANGUAGE_SWITCH_HEADERS,
      ...(allow ? {Allow: allow} : {}),
    },
  });
}

function firstForwardedValue(value: string | null): string | null {
  return value?.split(',', 1)[0]?.trim() || null;
}

function isSameRequestOrigin(request: NextRequest, source: URL): boolean {
  if (source.origin === request.nextUrl.origin) return true;

  const requestHost = firstForwardedValue(
    request.headers.get('x-forwarded-host'),
  ) ?? request.headers.get('host');
  const requestProtocol = firstForwardedValue(
    request.headers.get('x-forwarded-proto'),
  ) ?? request.nextUrl.protocol.slice(0, -1);

  return Boolean(
    requestHost &&
    requestProtocol &&
    source.host === requestHost &&
    source.protocol === `${requestProtocol}:`,
  );
}

export function switchLanguage(request: NextRequest, locale: string): NextResponse {
  if (locale !== 'en' && locale !== 'es') return noContent(404);

  const requestedPath = normalizeLocalPath(request.nextUrl.searchParams.get('path'));
  if (!requestedPath) return noContent(400);

  let query = '';
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const source = new URL(referer);
      const sourcePath = normalizeLocalPath(source.pathname);
      if (isSameRequestOrigin(request, source) && sourcePath === requestedPath) {
        query = source.search;
      }
    } catch {
      // A missing or untrusted Referer degrades to the validated pathname.
    }
  }

  const location = localizeHref(`${requestedPath}${query}`, locale);
  if (!location.startsWith('/') || location.startsWith('//')) return noContent(400);

  return new NextResponse(null, {
    status: 307,
    headers: {
      ...LANGUAGE_SWITCH_HEADERS,
      Location: location,
    },
  });
}

export function languageSwitchMethodNotAllowed() {
  return noContent(405, 'GET, HEAD');
}
