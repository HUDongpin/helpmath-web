import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

import {isDemoCandidateId} from './demos/candidates';
import {routing} from './i18n/routing';
import {
  EXECUTIVE_PREVIEW_COOKIE_NAME,
  getExecutivePreviewConfig,
  isExecutivePreviewAssetPath,
  isExecutivePreviewDemoPath,
  isExecutivePreviewProtectedPath,
  verifyExecutivePreviewSession,
} from './lib/executive-preview-access';
import {getDemoLifecycleState} from './lib/demo-lifecycle';
import {isDraftLegalPage} from './lib/legal-publishing';
import {isPublicPagePath} from './lib/public-paths';

const INTERNAL_LOCALE_HEADER = 'x-helpmath-internal-locale';
const INTERNAL_NOT_FOUND_PATH = '/site-not-found-internal/unmatched/route';
const EXECUTIVE_PREVIEW_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Cookie',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;
const EXECUTIVE_PREVIEW_ENTRY_CANONICAL_PATHS = new Map([
  ['/executive-preview', '/executive-preview'],
  ['/es/executive-preview', '/es/executive-preview'],
  ['/en/executive-preview', '/executive-preview'],
]);
const GATED_PUBLIC_CACHE_CONTROL = 'private, no-store, max-age=0';
const BLOCKED_PAGES_DATA_HEADERS = {
  'Cache-Control': GATED_PUBLIC_CACHE_CONTROL,
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

const publicFilePaths = new Set([
  '/icon.svg',
  '/manifest.webmanifest',
  '/opengraph-image.png',
  '/robots.txt',
  '/sitemap.xml',
  '/static-marketing-navigation.js'
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

function withExecutivePreviewHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(EXECUTIVE_PREVIEW_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function withGatedPublicHeaders(
  response: NextResponse,
  robots?: 'noindex-follow' | 'noindex-private',
) {
  response.headers.set('Cache-Control', GATED_PUBLIC_CACHE_CONTROL);
  if (robots === 'noindex-follow') {
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  } else if (robots === 'noindex-private') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}

function normalizedPathname(pathname: string) {
  const collapsed = pathname
    .replace(/\\+/gu, '/')
    .replace(/\/{2,}/gu, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/+$/u, '') : collapsed;
}

function isPagesDataPath(pathname: string) {
  const normalized = normalizedPathname(pathname);
  return normalized === '/_next/data' || normalized.startsWith('/_next/data/');
}

function canonicalizeExecutivePreviewEntry(request: NextRequest) {
  const requestPath = request.nextUrl.pathname;
  const normalizedRequestPath = normalizedPathname(requestPath);
  const canonicalPath = EXECUTIVE_PREVIEW_ENTRY_CANONICAL_PATHS.get(
    normalizedRequestPath,
  );

  if (!canonicalPath) return null;

  // Canonicalize before the App Router renders the page. A Server Component
  // redirect serializes the original search params into its RSC response body,
  // which would disclose a private candidate path even when Location is safe.
  // Only the exact local error marker is part of the supported entry contract.
  const canonicalSearch = request.nextUrl.searchParams.get('error') === '1'
    ? '?error=1'
    : '';
  const hasUnsupportedQuery = request.nextUrl.search !== canonicalSearch;
  const hasNonCanonicalPath = requestPath !== canonicalPath;
  if (!hasUnsupportedQuery && !hasNonCanonicalPath) return null;

  const canonical = new URL(request.url);
  canonical.pathname = canonicalPath;
  canonical.search = canonicalSearch;
  canonical.hash = '';
  return new NextResponse(null, {
    // Never permanently cache a private-entry normalization response.
    status: 307,
    headers: {
      ...EXECUTIVE_PREVIEW_HEADERS,
      Location: canonical.toString(),
    },
  });
}

function canonicalizePublicPath(request: NextRequest) {
  const canonicalPath = normalizedPathname(request.nextUrl.pathname);
  if (canonicalPath === request.nextUrl.pathname) return null;

  const canonical = new URL(request.url);
  canonical.pathname = canonicalPath;
  canonical.hash = '';
  return NextResponse.redirect(canonical, 308);
}

function demoCandidateIdFromPathname(pathname: string) {
  const match = /^\/(?:es\/)?demos\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(
    pathname,
  );
  const id = match?.[1];
  return id && isDemoCandidateId(id) ? id : null;
}

function gatedPublicResponse(pathname: string) {
  const localeFreePath = pathname.startsWith('/es/')
    ? pathname.slice(3)
    : pathname;
  if (localeFreePath === '/contact' || localeFreePath === '/demos') {
    return withGatedPublicHeaders(NextResponse.next());
  }
  const legalPage = /^\/(privacy|terms)$/u.exec(localeFreePath)?.[1];
  if (legalPage) {
    return withGatedPublicHeaders(
      NextResponse.next(),
      isDraftLegalPage(legalPage) ? 'noindex-follow' : undefined,
    );
  }
  return NextResponse.next();
}

export default async function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;
  const requestPathname = new URL(request.url).pathname;

  // Every Pages Router entry is server-rendered without the Next browser
  // runtime. Reject its unused data protocol before any rewrite can proxy an
  // internal path back into this application. NextRequest intentionally maps
  // a data URL's nextUrl.pathname to its page pathname, so inspect the raw URL.
  if (isPagesDataPath(requestPathname)) {
    return new NextResponse(null, {
      status: 404,
      headers: BLOCKED_PAGES_DATA_HEADERS,
    });
  }

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

  const canonicalExecutivePreviewEntry = canonicalizeExecutivePreviewEntry(request);
  if (canonicalExecutivePreviewEntry) return canonicalExecutivePreviewEntry;

  const canonicalPublicPath = canonicalizePublicPath(request);
  if (canonicalPublicPath) return canonicalPublicPath;

  const demoCandidateId = demoCandidateIdFromPathname(pathname);
  const demoLifecycle = demoCandidateId
    ? getDemoLifecycleState(demoCandidateId)
    : null;
  if (demoLifecycle?.public) {
    return withGatedPublicHeaders(
      NextResponse.next(),
      demoLifecycle.indexable ? undefined : 'noindex-private',
    );
  }

  if (isExecutivePreviewProtectedPath(pathname)) {
    const config = getExecutivePreviewConfig();
    const session = request.cookies.get(EXECUTIVE_PREVIEW_COOKIE_NAME)?.value;
    const accessGranted = config
      ? await verifyExecutivePreviewSession(session, config)
      : false;

    if (!accessGranted) {
      if (isExecutivePreviewAssetPath(pathname)) {
        return new NextResponse(null, {
          status: 404,
          headers: EXECUTIVE_PREVIEW_HEADERS,
        });
      }

      const locale = pathname.startsWith('/es/') ? 'es' : 'en';
      return withExecutivePreviewHeaders(notFoundRewrite(request, locale));
    }

    if (isExecutivePreviewDemoPath(pathname) || isExecutivePreviewAssetPath(pathname)) {
      return withExecutivePreviewHeaders(NextResponse.next());
    }
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
    if (demoCandidateId) {
      return withGatedPublicHeaders(
        notFoundRewrite(request, locale),
        'noindex-private',
      );
    }
    return isPublicPagePath(localeFree)
      ? gatedPublicResponse(pathname)
      : notFoundRewrite(request, locale);
  }

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (demoCandidateId) {
    return withGatedPublicHeaders(
      notFoundRewrite(request, routing.defaultLocale),
      'noindex-private',
    );
  }
  if (!isPublicPagePath(normalizedPath)) {
    return notFoundRewrite(request, routing.defaultLocale);
  }

  return gatedPublicResponse(pathname);
}

export const config = {
  matcher: '/((?!api(?:/|$)|_next(?:/|$)|_vercel(?:/|$)).*)'
};
