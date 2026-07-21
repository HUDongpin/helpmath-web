import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';

import {ExecutivePreviewPage} from '@/components/executive-preview-page';
import {isLocale} from '@/content';
import {
  EXECUTIVE_PREVIEW_COOKIE_NAME,
  getExecutivePreviewConfig,
  getExecutivePreviewReturnTo,
  verifyExecutivePreviewSession,
} from '@/lib/executive-preview-access';

export const dynamic = 'force-dynamic';

type PreviewSearchParams = {
  error?: string | string[];
  returnTo?: string | string[];
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  return {
    title: locale === 'es' ? 'Vista previa ejecutiva privada' : 'Private executive preview',
    description:
      locale === 'es'
        ? 'Área restringida para la revisión ejecutiva interna de prototipos JavaScript de HELP Math.'
        : 'Restricted area for internal executive review of HELP Math JavaScript prototypes.',
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      googleBot: {index: false, follow: false, noarchive: true},
    },
  };
}

export default async function ExecutivePreviewRoute({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<PreviewSearchParams>;
}) {
  const [{locale}, query, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  if (!isLocale(locale)) notFound();

  const config = getExecutivePreviewConfig();
  const returnTo = getExecutivePreviewReturnTo(first(query.returnTo), locale);
  const sessionToken = cookieStore.get(EXECUTIVE_PREVIEW_COOKIE_NAME)?.value;
  const authenticated = config
    ? await verifyExecutivePreviewSession(sessionToken, config)
    : false;

  return (
    <ExecutivePreviewPage
      error={first(query.error) === '1'}
      locale={locale}
      returnTo={returnTo}
      state={!config ? 'unavailable' : authenticated ? 'authenticated' : 'login'}
    />
  );
}
