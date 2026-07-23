import type {Metadata, Viewport} from 'next';
import {notFound} from 'next/navigation';

import {SiteFooter} from '@/components/site-footer';
import {SiteHeader} from '@/components/site-header';
import {getSiteContent} from '@/content';
import type {Locale} from '@/content/types';
import {BROWSER_LOCATION_CHANGE_EVENT} from '@/i18n/browser-location';
import {LocaleProvider} from '@/i18n/locale-context';
import {routing} from '@/i18n/routing';
import {
  getSiteUrl,
  SITE_DESCRIPTIONS,
  SITE_NAME,
} from '@/lib/site';

import {nunitoSans} from '../fonts';
import '../globals.css';

const RESOURCE_HASH_BOOTSTRAP = `
(() => {
  try {
    const locationChangeEvent = ${JSON.stringify(BROWSER_LOCATION_CHANGE_EVENT)};
    const replaceLocation = (url) => {
      window.history.replaceState(window.history.state, '', url);
      window.dispatchEvent(new Event(locationChangeEvent));
    };
    const resourceHash = window.location.hash;
    const isResourcePath = /^\\/(?:es\\/)?resources\\/?$/u.test(window.location.pathname);
    if (!isResourcePath || !resourceHash) return;
    document.documentElement.classList.add('resource-fragment-navigation');
    window.__helpMathDeferredResourceHash = resourceHash;
    const resourcePath = window.location.pathname;
    const resourceSearch = window.location.search;
    replaceLocation(resourcePath + resourceSearch);

    const isPendingResourceHash = () =>
      window.__helpMathDeferredResourceHash === resourceHash &&
      window.location.pathname === resourcePath &&
      (!window.location.hash || window.location.hash === resourceHash);
    const restoreVisibleHash = () => {
      if (!isPendingResourceHash()) return false;
      replaceLocation(resourcePath + resourceSearch + resourceHash);
      return true;
    };
    const cancelStaleResourceHash = () => {
      if (window.location.hash === resourceHash) return;
      delete window.__helpMathDeferredResourceHash;
      let target = null;
      try {
        target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      } catch {}
      if (!target || !target.classList.contains('resource-entry')) {
        document.documentElement.classList.remove('resource-fragment-navigation');
      }
    };
    const exposeCanonicalHash = () => {
      if (!restoreVisibleHash()) return;
      // Start observing user changes only after the initial navigation's
      // canonical hash is restored. This avoids treating that navigation as a
      // user-authored hash change in browsers that deliver it asynchronously.
      window.addEventListener('hashchange', cancelStaleResourceHash);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', exposeCanonicalHash, {once: true});
    } else {
      exposeCanonicalHash();
    }
    const restoreResourceHash = () => {
      if (!isPendingResourceHash()) return;
      try {
        restoreVisibleHash();
        delete window.__helpMathDeferredResourceHash;

        let target = null;
        try {
          target = document.getElementById(decodeURIComponent(resourceHash.slice(1)));
        } catch {}
        if (!target || !target.classList.contains('resource-entry')) {
          document.documentElement.classList.remove('resource-fragment-navigation');
        }
        target?.scrollIntoView({behavior: 'auto', block: 'start'});
      } catch {
        document.documentElement.classList.remove('resource-fragment-navigation');
      }
    };
    const queueFallback = () => {
      // DOMContentLoaded already exposed the canonical URL without triggering
      // a native jump. Load only schedules a guarded no-hydration scroll.
      if (!restoreVisibleHash()) return;
      window.setTimeout(() => {
        if (!isPendingResourceHash()) return;
        const fontsReady = document.fonts?.ready ?? Promise.resolve();
        fontsReady.then(() => requestAnimationFrame(() => {
          requestAnimationFrame(restoreResourceHash);
        }));
      }, 1000);
    };
    if (document.readyState === 'complete') queueFallback();
    else window.addEventListener('load', queueFallback, {once: true});
  } catch {}
})();`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  if (!routing.locales.some((candidate) => candidate === locale)) notFound();
  const appLocale = locale as Locale;
  const content = getSiteContent(appLocale).shared;

  return {
    metadataBase: getSiteUrl(),
    title: {
      default: `${SITE_NAME} · ${content.siteTagline}`,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTIONS[appLocale],
    applicationName: SITE_NAME,
    category: 'education',
  };
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1768d4'
};

export function generateStaticParams() {
  return [{locale: 'en'}, {locale: 'es'}];
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  if (!routing.locales.some((candidate) => candidate === locale)) notFound();
  const appLocale = locale as Locale;
  const content = getSiteContent(appLocale).shared;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{__html: RESOURCE_HASH_BOOTSTRAP}}
          id="help-math-resource-hash-bootstrap"
        />
      </head>
      <body className={nunitoSans.variable}>
        <LocaleProvider locale={appLocale}>
          <a className="skip-link" href="#main-content">
            {content.skipToContent}
          </a>
          <SiteHeader content={content} locale={appLocale} />
          {children}
          <SiteFooter content={content} locale={appLocale} />
        </LocaleProvider>
      </body>
    </html>
  );
}
