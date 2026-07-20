import type {Metadata} from 'next';

import type {Locale, PageMetadata} from '@/content/types';

import {getSiteUrl, localizedPath, SITE_NAME} from './site';

export function createPageMetadata(
  locale: Locale,
  page: PageMetadata,
  path = '/'
): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = new URL(localizedPath(locale, path), siteUrl).toString();
  const english = new URL(localizedPath('en', path), siteUrl).toString();
  const spanish = new URL(localizedPath('es', path), siteUrl).toString();

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical,
      languages: {
        en: english,
        es: spanish,
        'x-default': english
      }
    },
    openGraph: {
      title: page.title,
      description: page.description,
      locale: locale === 'es' ? 'es_US' : 'en_US',
      alternateLocale: locale === 'es' ? ['en_US'] : ['es_US'],
      siteName: SITE_NAME,
      type: 'website',
      url: canonical,
      images: [
        {
          url: '/opengraph-image.png',
          width: 1731,
          height: 909,
          alt: `${SITE_NAME}: ${page.title}`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: ['/opengraph-image.png']
    }
  };
}
