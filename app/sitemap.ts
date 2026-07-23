import type {MetadataRoute} from 'next';

import {getSiteUrl, localizedPath} from '@/lib/site';
import {
  demoLifecycleUpdatedAt,
  getDemoLifecycleCatalog,
} from '@/lib/demo-lifecycle';
import {getPublishedLegalPagePaths} from '@/lib/legal-publishing';
import {
  SITEMAP_DEMO_FALLBACK_LAST_MODIFIED,
  STATIC_SITEMAP_PAGES,
} from '@/lib/sitemap-metadata';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const publishedLegalPaths = new Set(getPublishedLegalPagePaths());
  const lifecycle = getDemoLifecycleCatalog();
  const indexableDemoRoutes = lifecycle.indexableIds.map(
    (id) => `/demos/${id}` as const,
  );
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
