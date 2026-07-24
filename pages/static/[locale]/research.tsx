import type {GetStaticPaths, GetStaticProps} from 'next';

import {ResearchPage} from '@/components/content-pages';
import {MainContent} from '@/components/main-content';
import {StaticPageHead} from '@/components/static-page-head';
import {StaticSiteShell} from '@/components/static-site-shell';
import {getSiteContent, isLocale, type Locale, type ResearchContent, type SharedContent} from '@/content';

type ResearchProps = {
  locale: Locale;
  page: ResearchContent;
  shared: SharedContent;
};

export const config = {runtime: 'nodejs', unstable_runtimeJS: false};

export const getStaticPaths: GetStaticPaths = () => ({
  fallback: false,
  paths: [{params: {locale: 'en'}}, {params: {locale: 'es'}}],
});

export const getStaticProps: GetStaticProps<ResearchProps> = ({params}) => {
  if (typeof params?.locale !== 'string' || !isLocale(params.locale)) {
    return {notFound: true};
  }
  const locale = params.locale;
  const content = getSiteContent(locale);

  return {props: {locale, page: content.pages.research, shared: content.shared}};
};

export default function StaticResearch({locale, page, shared}: ResearchProps) {
  return (
    <>
      <StaticPageHead locale={locale} metadata={page.metadata} pathname="/research" />
      <StaticSiteShell content={shared} locale={locale} pathname="/research">
        <MainContent>
          <ResearchPage content={page} locale={locale} />
        </MainContent>
      </StaticSiteShell>
    </>
  );
}
