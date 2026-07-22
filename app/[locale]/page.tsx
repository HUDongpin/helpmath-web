import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

import {HomePage} from '@/components/home-page';
import {getSiteContent, isLocale} from '@/content';
import {createPageMetadata} from '@/lib/metadata';
import {getSiteUrl, SITE_DESCRIPTIONS, SITE_NAME} from '@/lib/site';

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return createPageMetadata(locale, getSiteContent(locale).pages.home.metadata);
}

export default async function Home({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const websiteUrl = getSiteUrl().toString();
  const websiteData = locale === 'en'
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${websiteUrl}#website`,
        name: SITE_NAME,
        url: websiteUrl,
        description: SITE_DESCRIPTIONS.en,
        inLanguage: ['en', 'es'],
      }).replaceAll('<', '\\u003c')
    : null;
  return (
    <>
      <main id="main-content">
        <HomePage content={getSiteContent(locale).pages.home} locale={locale} />
      </main>
      {websiteData ? (
        <script
          dangerouslySetInnerHTML={{__html: websiteData}}
          data-structured-data="website"
          type="application/ld+json"
        />
      ) : null}
    </>
  );
}
