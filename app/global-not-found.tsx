import type {Metadata} from 'next';
import {Fredoka, Nunito_Sans} from 'next/font/google';
import {headers} from 'next/headers';

import {NotFoundPage} from '@/components/not-found-page';
import {SiteFooter} from '@/components/site-footer';
import {SiteHeader} from '@/components/site-header';
import {getSiteContent} from '@/content';
import type {Locale} from '@/content/types';
import {LocaleProvider} from '@/i18n/navigation';

import './globals.css';

const INTERNAL_LOCALE_HEADER = 'x-helpmath-internal-locale';

const displayFont = Fredoka({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-fredoka',
});

const bodyFont = Nunito_Sans({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-nunito',
});

async function getNotFoundLocale(): Promise<Locale> {
  return (await headers()).get(INTERNAL_LOCALE_HEADER) === 'es' ? 'es' : 'en';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getNotFoundLocale();
  return {
    title: locale === 'es'
      ? 'Página no encontrada · HELP Math'
      : 'Page not found · HELP Math',
  };
}

export default async function GlobalNotFound() {
  const locale = await getNotFoundLocale();
  const content = getSiteContent(locale).shared;

  return (
    <html lang={locale}>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <LocaleProvider locale={locale}>
          <a className="skip-link" href="#main-content">
            {content.skipToContent}
          </a>
          <SiteHeader content={content} languageSwitcherPath="/" locale={locale} />
          <NotFoundPage locale={locale} />
          <SiteFooter content={content} />
        </LocaleProvider>
      </body>
    </html>
  );
}
