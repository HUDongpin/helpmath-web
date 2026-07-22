import type {Metadata} from 'next';

import {AboutPage} from '@/components/content-pages';
import {MainContent} from '@/components/main-content';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';
import {getSiteUrl, localizedPath} from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: 'en' | 'es'}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.about.metadata, '/about');
}

export default async function AboutRoute({
  params,
}: {
  params: Promise<{locale: 'en' | 'es'}>;
}) {
  const {locale} = await params;
  const content = getSiteContent(locale).pages.about;
  const websiteUrl = getSiteUrl().toString();
  const pageUrl = new URL(localizedPath(locale, '/about'), getSiteUrl()).toString();
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: content.metadata.title,
    description: content.metadata.description,
    inLanguage: locale,
    isPartOf: {'@id': `${websiteUrl}#website`},
    about: [
      {'@type': 'Thing', name: 'HELP Math 1.0'},
      {
        '@type': 'Thing',
        name: locale === 'es'
          ? 'Modernización propuesta de HELP Math 2.0'
          : 'Proposed HELP Math 2.0 modernization',
      },
    ],
    mentions: [
      {
        '@type': 'Organization',
        name: 'Boulder Learning',
        url: 'https://www.boulderlearning.com/',
      },
      {
        '@type': 'Organization',
        name: 'PedaNova',
        url: 'https://www.pedanova.tech/',
      },
    ],
  }).replaceAll('<', '\\u003c');
  return (
    <>
      <MainContent>
        <AboutPage content={content} />
      </MainContent>
      <script
        dangerouslySetInnerHTML={{__html: structuredData}}
        data-structured-data="about-page"
        type="application/ld+json"
      />
    </>
  );
}
