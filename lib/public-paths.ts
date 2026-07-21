import {demoRoutes} from '../demos/catalog';

export const publicPagePaths = Object.freeze([
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
  ...demoRoutes,
]);

const publicPagePathSet = new Set<string>(publicPagePaths);

export function isPublicPagePath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return publicPagePathSet.has(normalized);
}
