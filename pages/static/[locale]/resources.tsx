import type {GetStaticPaths, GetStaticProps} from 'next';

import {MainContent} from '@/components/main-content';
import {ResourcesPage} from '@/components/resources-page';
import {StaticPageHead} from '@/components/static-page-head';
import {StaticSiteShell} from '@/components/static-site-shell';
import {getSiteContent, isLocale, type Locale, type ResourcesContent, type SharedContent} from '@/content';

type ResourcesProps = {
  locale: Locale;
  page: ResourcesContent;
  shared: SharedContent;
};

export const config = {runtime: 'nodejs', unstable_runtimeJS: false};

export const getStaticPaths: GetStaticPaths = () => ({
  fallback: false,
  paths: [{params: {locale: 'en'}}, {params: {locale: 'es'}}],
});

export const getStaticProps: GetStaticProps<ResourcesProps> = ({params}) => {
  if (typeof params?.locale !== 'string' || !isLocale(params.locale)) {
    return {notFound: true};
  }
  const locale = params.locale;
  const content = getSiteContent(locale);

  return {props: {locale, page: content.pages.resources, shared: content.shared}};
};

export default function StaticResources({locale, page, shared}: ResourcesProps) {
  return (
    <>
      <StaticPageHead locale={locale} metadata={page.metadata} pathname="/resources" />
      <StaticSiteShell content={shared} locale={locale} pathname="/resources">
        <MainContent>
          <ResourcesPage content={page} locale={locale} />
        </MainContent>
      </StaticSiteShell>
      <script data-static-resource-controller="" defer src="/static-resource-library.js" />
    </>
  );
}
