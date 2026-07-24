import type {ReactNode} from 'react';

import type {Locale, SharedContent} from '@/content/types';

import {SiteFooter} from './site-footer';
import {StaticSiteHeader} from './static-site-header';

export function StaticSiteShell({
  children,
  content,
  locale,
  pathname,
}: {
  children: ReactNode;
  content: SharedContent;
  locale: Locale;
  pathname: string;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        {content.skipToContent}
      </a>
      <StaticSiteHeader content={content} locale={locale} pathname={pathname} />
      {children}
      <SiteFooter content={content} locale={locale} />
      <script data-static-marketing-controller="" defer src="/static-marketing-navigation.js" />
    </>
  );
}
