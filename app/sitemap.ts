import type {MetadataRoute} from 'next';

import {getSiteUrl, localizedPath} from '@/lib/site';
import {indexableDemoRoutes} from '@/demos/catalog';

const routes = [
  '/',
  '/about',
  '/approach',
  '/curriculum',
  '/research',
  '/resources',
  '/demos',
  ...indexableDemoRoutes,
  '/support',
  '/login',
  '/contact'
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date('2026-07-21T00:00:00.000Z');

  return routes.flatMap((route) =>
    (['en', 'es'] as const).map((locale) => ({
      url: new URL(localizedPath(locale, route), siteUrl).toString(),
      lastModified,
      changeFrequency: route === '/' ? ('weekly' as const) : ('monthly' as const),
      priority: route === '/' ? 1 : route.startsWith('/demos') ? 0.8 : 0.7,
      alternates: {
        languages: {
          en: new URL(localizedPath('en', route), siteUrl).toString(),
          es: new URL(localizedPath('es', route), siteUrl).toString(),
          'x-default': new URL(localizedPath('en', route), siteUrl).toString()
        }
      }
    }))
  );
}
