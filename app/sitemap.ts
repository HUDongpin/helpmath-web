import type {MetadataRoute} from 'next';

import {getSiteUrl, localizedPath} from '@/lib/site';
import {indexableDemoRoutes} from '@/demos/catalog';
import {demoLifecycleUpdatedAt} from '@/lib/demo-lifecycle';
import {PUBLISHED_LEGAL_PAGE_PATHS} from '@/lib/legal-publishing';

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
  '/contact',
  ...PUBLISHED_LEGAL_PAGE_PATHS,
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const siteLastModified = new Date('2026-07-21T00:00:00.000Z');
  const demoLastModified = demoLifecycleUpdatedAt
    ? new Date(demoLifecycleUpdatedAt)
    : siteLastModified;

  return routes.flatMap((route) =>
    (['en', 'es'] as const).map((locale) => ({
      url: new URL(localizedPath(locale, route), siteUrl).toString(),
      lastModified: route === '/demos' || route.startsWith('/demos/')
        ? demoLastModified
        : siteLastModified,
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
