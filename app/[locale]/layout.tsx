import type {Metadata, Viewport} from 'next';
import {Fredoka, Nunito_Sans} from 'next/font/google';
import {notFound} from 'next/navigation';

import {SiteFooter} from '@/components/site-footer';
import {SiteHeader} from '@/components/site-header';
import {getSiteContent} from '@/content';
import type {Locale} from '@/content/types';
import {LocaleProvider} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';
import {getSiteUrl, SITE_DESCRIPTION, SITE_NAME} from '@/lib/site';

import '../globals.css';

const displayFont = Fredoka({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-fredoka'
});

const bodyFont = Nunito_Sans({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-nunito'
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {default: `${SITE_NAME} · Math language made visible`, template: `%s · ${SITE_NAME}`},
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: 'education',
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {index: true, follow: true}
};

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
  const organizationData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: SITE_NAME,
    url: getSiteUrl().toString(),
    description: SITE_DESCRIPTION,
    availableLanguage: ['English', 'Spanish']
  }).replaceAll('<', '\\u003c');

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <LocaleProvider locale={appLocale}>
          <a className="skip-link" href="#main-content">
            {content.skipToContent}
          </a>
          <SiteHeader content={content} locale={appLocale} />
          {children}
          <SiteFooter content={content} />
        </LocaleProvider>
        <script
          dangerouslySetInnerHTML={{__html: organizationData}}
          type="application/ld+json"
        />
      </body>
    </html>
  );
}
