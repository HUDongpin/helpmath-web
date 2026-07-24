import type {GetStaticPaths, GetStaticProps} from 'next';

import {HomePage} from '@/components/home-page';
import {MainContent} from '@/components/main-content';
import {StaticPageHead} from '@/components/static-page-head';
import {StaticSiteShell} from '@/components/static-site-shell';
import {getSiteContent, isLocale, type HomeContent, type Locale, type SharedContent} from '@/content';
import {getSiteUrl, SITE_DESCRIPTIONS, SITE_NAME} from '@/lib/site';

type HomeProps = {
  locale: Locale;
  page: HomeContent;
  shared: SharedContent;
};

export const config = {runtime: 'nodejs', unstable_runtimeJS: false};

export const getStaticPaths: GetStaticPaths = () => ({
  fallback: false,
  paths: [{params: {locale: 'en'}}, {params: {locale: 'es'}}],
});

export const getStaticProps: GetStaticProps<HomeProps> = ({params}) => {
  if (typeof params?.locale !== 'string' || !isLocale(params.locale)) {
    return {notFound: true};
  }
  const locale = params.locale;
  const content = getSiteContent(locale);

  return {props: {locale, page: content.pages.home, shared: content.shared}};
};

export default function StaticHome({locale, page, shared}: HomeProps) {
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
      <StaticPageHead locale={locale} metadata={page.metadata} pathname="/" />
      <StaticSiteShell content={shared} locale={locale} pathname="/">
        <MainContent>
          <HomePage content={page} locale={locale} />
        </MainContent>
        {websiteData ? (
          <script
            dangerouslySetInnerHTML={{__html: websiteData}}
            data-structured-data="website"
            type="application/ld+json"
          />
        ) : null}
      </StaticSiteShell>
    </>
  );
}
