import {demoRoutes, reviewDemoRoutes} from '../demos/catalog';

export const executivePreviewEntryPath = '/executive-preview' as const;

export const publicPagePaths = Object.freeze([...new Set([
  '/',
  '/about',
  '/approach',
  '/curriculum',
  '/research',
  '/resources',
  '/support',
  '/login',
  '/contact',
  '/privacy',
  '/terms',
  '/demos',
  executivePreviewEntryPath,
  ...demoRoutes,
])]);

export const routablePagePaths = Object.freeze([...new Set([
  ...publicPagePaths,
  ...reviewDemoRoutes,
])]);

const publicPagePathSet = new Set<string>(publicPagePaths);

export function isPublicPagePath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return publicPagePathSet.has(normalized);
}
