import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

const EXECUTIVE_PREVIEW_HEADERS = {
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
      headers: EXECUTIVE_PREVIEW_HEADERS,
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
      ...EXECUTIVE_PREVIEW_HEADERS,
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
