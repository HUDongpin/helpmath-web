import Head from 'next/head';

import type {Locale, PageMetadata} from '@/content/types';
import {getSiteUrl, localizedPath, SITE_NAME} from '@/lib/site';

export type StaticMarketingPath = '/' | '/demos' | '/research' | '/resources';

function metadataUrl(locale: Locale, pathname: StaticMarketingPath, siteUrl: URL): string {
  const value = new URL(localizedPath(locale, pathname), siteUrl);
  return value.pathname === '/' && !value.search && !value.hash
    ? value.origin
    : value.toString();
}

export function StaticPageHead({
  locale,
  metadata,
  pathname,
}: {
  locale: Locale;
  metadata: PageMetadata;
  pathname: StaticMarketingPath;
}) {
  const siteUrl = getSiteUrl();
  const canonical = metadataUrl(locale, pathname, siteUrl);
  const english = metadataUrl('en', pathname, siteUrl);
  const spanish = metadataUrl('es', pathname, siteUrl);
  const socialTitle = pathname === '/' ? `${SITE_NAME} · ${metadata.title}` : metadata.title;
  const title = pathname === '/' ? socialTitle : `${metadata.title} · ${SITE_NAME}`;
  const socialImage = new URL('/opengraph-image.png', siteUrl).toString();

  return (
    <Head>
      <title>{title}</title>
      <meta content={metadata.description} name="description" />
      <meta content="width=device-width, initial-scale=1" key="viewport" name="viewport" />
      <meta content={SITE_NAME} name="application-name" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <meta content="education" name="category" />
      <meta content="light" name="color-scheme" />
      <meta content="#1768d4" name="theme-color" />
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en" href={english} />
      <link rel="alternate" hrefLang="es" href={spanish} />
      <link rel="alternate" hrefLang="x-default" href={english} />
      <meta content={socialTitle} property="og:title" />
      <meta content={metadata.description} property="og:description" />
      <meta content={locale === 'es' ? 'es_US' : 'en_US'} property="og:locale" />
      <meta content={locale === 'es' ? 'en_US' : 'es_US'} property="og:locale:alternate" />
      <meta content={SITE_NAME} property="og:site_name" />
      <meta content="website" property="og:type" />
      <meta content={canonical} property="og:url" />
      <meta content={socialImage} property="og:image" />
      <meta content="1731" property="og:image:width" />
      <meta content="909" property="og:image:height" />
      <meta content={`${SITE_NAME}: ${metadata.title}`} property="og:image:alt" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content={socialTitle} name="twitter:title" />
      <meta content={metadata.description} name="twitter:description" />
      <meta content={socialImage} name="twitter:image" />
      <link href="/icon.svg" rel="icon" sizes="any" type="image/svg+xml" />
    </Head>
  );
}
