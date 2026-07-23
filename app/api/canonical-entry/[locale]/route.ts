import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

const CANONICAL_ENTRY_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Cookie',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export const dynamic = 'force-dynamic';

function canonicalize(
  request: NextRequest,
  locale: string,
) {
  if (locale !== 'en' && locale !== 'es') {
    return new NextResponse(null, {
      status: 404,
      headers: CANONICAL_ENTRY_HEADERS,
    });
  }

  const canonicalPath = locale === 'es'
    ? '/es/executive-preview'
    : '/executive-preview';
  const preserveError =
    request.nextUrl.searchParams.get('error') === '1';

  return new NextResponse(null, {
    status: 307,
    headers: {
      ...CANONICAL_ENTRY_HEADERS,
      Location: `${canonicalPath}${preserveError ? '?error=1' : ''}`,
    },
  });
}

type RouteContext = {
  params: Promise<{locale: string}>;
};

export async function GET(request: NextRequest, {params}: RouteContext) {
  return canonicalize(request, (await params).locale);
}

export const HEAD = GET;

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,
    headers: {
      ...CANONICAL_ENTRY_HEADERS,
      Allow: 'GET, HEAD',
    },
  });
}

export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
