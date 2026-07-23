import type {Metadata} from 'next';
import {headers} from 'next/headers';

import {NotFoundPage} from '@/components/not-found-page';
import {SiteFooter} from '@/components/site-footer';
import {SiteHeader} from '@/components/site-header';
import {getSiteContent} from '@/content';
import type {Locale} from '@/content/types';
import {LocaleProvider} from '@/i18n/locale-context';

import {nunitoSans} from './fonts';
import './globals.css';

const INTERNAL_LOCALE_HEADER = 'x-helpmath-internal-locale';

async function getNotFoundLocale(): Promise<Locale> {
  return (await headers()).get(INTERNAL_LOCALE_HEADER) === 'es' ? 'es' : 'en';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getNotFoundLocale();
  return {
    title: locale === 'es'
      ? 'Página no encontrada · HELP Math'
      : 'Page not found · HELP Math',
    robots: {
      index: false,
      follow: false,
      googleBot: {index: false, follow: false},
    },
  };
}

export default async function GlobalNotFound() {
  const locale = await getNotFoundLocale();
  const content = getSiteContent(locale).shared;

  return (
    <html lang={locale}>
      <body className={nunitoSans.variable}>
        <LocaleProvider locale={locale}>
          <a className="skip-link" href="#main-content">
            {content.skipToContent}
          </a>
          <SiteHeader content={content} languageSwitcherPath="/" locale={locale} />
          <NotFoundPage locale={locale} />
          <SiteFooter content={content} locale={locale} />
        </LocaleProvider>
      </body>
    </html>
  );
}
