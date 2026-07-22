export type StaticSitemapPage = {
  path: `/${string}`;
  lastModified: string;
  publication?: 'legal';
};

/**
 * The canonical source for static-page sitemap dates.
 *
 * Demo dates intentionally do not live here: they come from the validated
 * demo lifecycle manifest so a demo release cannot drift from its evidence.
 */
export const STATIC_SITEMAP_PAGES: readonly StaticSitemapPage[] = [
  {path: '/', lastModified: '2026-07-22T00:00:00.000Z'},
  {path: '/about', lastModified: '2026-07-22T00:00:00.000Z'},
  {path: '/approach', lastModified: '2026-07-21T00:00:00.000Z'},
  {path: '/curriculum', lastModified: '2026-07-21T00:00:00.000Z'},
  {path: '/research', lastModified: '2026-07-22T00:00:00.000Z'},
  {path: '/resources', lastModified: '2026-07-22T00:00:00.000Z'},
  {path: '/support', lastModified: '2026-07-22T00:00:00.000Z'},
  {path: '/login', lastModified: '2026-07-21T00:00:00.000Z'},
  {path: '/contact', lastModified: '2026-07-21T00:00:00.000Z'},
  {
    path: '/privacy',
    lastModified: '2026-07-21T00:00:00.000Z',
    publication: 'legal',
  },
  {
    path: '/terms',
    lastModified: '2026-07-21T00:00:00.000Z',
    publication: 'legal',
  },
] as const;

export const SITEMAP_DEMO_FALLBACK_LAST_MODIFIED =
  STATIC_SITEMAP_PAGES[0].lastModified;
