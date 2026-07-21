import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

import {routing} from './i18n/routing';
import {isPublicPagePath} from './lib/public-paths';

const INTERNAL_LOCALE_HEADER = 'x-helpmath-internal-locale';
const INTERNAL_NOT_FOUND_PATH = '/site-not-found-internal/unmatched/route';

const publicFilePaths = new Set([
  '/icon.svg',
  '/manifest.webmanifest',
  '/opengraph-image.png',
  '/robots.txt',
  '/sitemap.xml'
]);

function notFoundRewrite(request: NextRequest, locale: 'en' | 'es') {
  const rewritten = request.nextUrl.clone();
  rewritten.pathname = INTERNAL_NOT_FOUND_PATH;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(INTERNAL_LOCALE_HEADER, locale);
  const response = NextResponse.rewrite(rewritten, {
    request: {headers: requestHeaders},
  });
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export default function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;

  if (
    pathname === INTERNAL_NOT_FOUND_PATH &&
    routing.locales.some((locale) => request.headers.get(INTERNAL_LOCALE_HEADER) === locale)
  ) {
    return NextResponse.next();
  }

  if (
    publicFilePaths.has(pathname) ||
    pathname.startsWith('/.well-known/')
  ) {
    return NextResponse.next();
  }

  // English is canonical without a locale prefix. Keep this redirect in the
  // proxy so it does not intercept the internal /en rewrite used below.
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const canonical = request.nextUrl.clone();
    canonical.pathname = pathname.slice(3) || '/';
    return NextResponse.redirect(canonical, 308);
  }

  if (pathname === '/es' || pathname.startsWith('/es/')) {
    const locale = pathname.slice(1, 3) as 'en' | 'es';
    const localeFree = pathname.slice(3) || '/';
    return isPublicPagePath(localeFree) ? NextResponse.next() : notFoundRewrite(request, locale);
  }

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (!isPublicPagePath(normalizedPath)) return notFoundRewrite(request, routing.defaultLocale);

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api(?:/|$)|_next(?:/|$)|_vercel(?:/|$)).*)'
};
