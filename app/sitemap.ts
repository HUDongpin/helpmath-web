import type {MetadataRoute} from 'next';

import {getSiteUrl, localizedPath} from '@/lib/site';
import {indexableDemoRoutes} from '@/demos/catalog';
import {demoLifecycleUpdatedAt} from '@/lib/demo-lifecycle';
import {PUBLISHED_LEGAL_PAGE_PATHS} from '@/lib/legal-publishing';
import {
  SITEMAP_DEMO_FALLBACK_LAST_MODIFIED,
  STATIC_SITEMAP_PAGES,
} from '@/lib/sitemap-metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const publishedLegalPaths = new Set(PUBLISHED_LEGAL_PAGE_PATHS);
  const staticPages = STATIC_SITEMAP_PAGES.filter(
    ({path, publication}) => publication !== 'legal' || publishedLegalPaths.has(path),
  );
  const demoLastModified = demoLifecycleUpdatedAt
    ? new Date(demoLifecycleUpdatedAt)
    : new Date(SITEMAP_DEMO_FALLBACK_LAST_MODIFIED);
  const pages = [
    ...staticPages.map(({path, lastModified}) => ({
      route: path,
      lastModified: new Date(lastModified),
    })),
    {route: '/demos', lastModified: demoLastModified},
    ...indexableDemoRoutes.map((route) => ({route, lastModified: demoLastModified})),
  ];

  return pages.flatMap(({route, lastModified}) =>
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
