import type {Metadata, Viewport} from 'next';
import {notFound} from 'next/navigation';

import {SiteFooter} from '@/components/site-footer';
import {SiteHeader} from '@/components/site-header';
import {getSiteContent} from '@/content';
import type {Locale} from '@/content/types';
import {LocaleProvider} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';
import {
  getSiteUrl,
  SITE_DESCRIPTIONS,
  SITE_NAME,
} from '@/lib/site';

import '../globals.css';

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
      <body>
        <LocaleProvider locale={appLocale}>
          <a className="skip-link" href="#main-content">
            {content.skipToContent}
          </a>
          <SiteHeader content={content} locale={appLocale} />
          {children}
          <SiteFooter content={content} />
        </LocaleProvider>
      </body>
    </html>
  );
}
