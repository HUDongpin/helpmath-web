import type {MetadataRoute} from 'next';

import {indexableDemoRoutes} from '@/demos/catalog';
import {demoLifecycleUpdatedAt} from '@/lib/demo-lifecycle';
import {PUBLISHED_LEGAL_PAGE_PATHS} from '@/lib/legal-publishing';
import {buildSitemapEntriesSafely} from '@/lib/sitemap-entries';
import {STATIC_SITEMAP_PAGES} from '@/lib/sitemap-metadata';
import {getSiteUrl} from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntriesSafely(() => ({
    siteUrl: getSiteUrl(),
    staticPages: STATIC_SITEMAP_PAGES,
    publishedLegalPaths: PUBLISHED_LEGAL_PAGE_PATHS,
    readIndexableDemoRoutes: () => indexableDemoRoutes,
    readDemoLastModified: () => demoLifecycleUpdatedAt,
  }));
}
