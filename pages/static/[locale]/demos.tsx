import type {GetServerSideProps} from 'next';

import {DemosPage} from '@/components/demos-page';
import {MainContent} from '@/components/main-content';
import {StaticPageHead} from '@/components/static-page-head';
import {StaticSiteShell} from '@/components/static-site-shell';
import {getRuntimeSiteContent, isLocale, type DemosContent, type Locale, type SharedContent} from '@/content';

type DemosProps = {
  locale: Locale;
  page: DemosContent;
  shared: SharedContent;
};

export const config = {runtime: 'nodejs', unstable_runtimeJS: false};

export const getServerSideProps: GetServerSideProps<DemosProps> = async ({params, res}) => {
  if (typeof params?.locale !== 'string' || !isLocale(params.locale)) {
    return {notFound: true};
  }
  const locale = params.locale;
  const content = getRuntimeSiteContent(locale);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  return {props: {locale, page: content.pages.demos, shared: content.shared}};
};

export default function StaticDemos({locale, page, shared}: DemosProps) {
  return (
    <>
      <StaticPageHead locale={locale} metadata={page.metadata} pathname="/demos" />
      <StaticSiteShell content={shared} locale={locale} pathname="/demos">
        <MainContent>
          <DemosPage content={page} locale={locale} />
        </MainContent>
      </StaticSiteShell>
    </>
  );
}
