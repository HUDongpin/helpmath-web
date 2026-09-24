import type {MetadataRoute} from 'next';

import {getSiteUrl, localizedPath} from './site';
import {
  SITEMAP_DEMO_FALLBACK_LAST_MODIFIED,
  type StaticSitemapPage,
} from './sitemap-metadata';

const LOCALES = ['en', 'es'] as const;
const FALLBACK_SITE_URL = 'https://www.helpmath.ai';

export type SitemapBuildInput = {
  siteUrl: URL;
  staticPages: readonly StaticSitemapPage[];
  publishedLegalPaths: readonly string[];
  readIndexableDemoRoutes: () => readonly string[];
  readDemoLastModified: () => string | null;
};

function parseSitemapDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const fallbackLastModified = parseSitemapDate(SITEMAP_DEMO_FALLBACK_LAST_MODIFIED)
  ?? new Date('2026-07-22T00:00:00.000Z');

function absoluteUrl(siteUrl: URL, path: string): string | null {
  try {
    const url = new URL(path, siteUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function changeFrequencyFor(route: string): 'weekly' | 'monthly' {
  return route === '/' ? 'weekly' : 'monthly';
}

function priorityFor(route: string): number {
  if (route === '/') return 1;
  if (route.startsWith('/demos')) return 0.8;
  return 0.7;
}

function localizedEntries(
  siteUrl: URL,
  route: string,
  lastModified: Date,
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  const urls: string[] = [];

  for (const locale of LOCALES) {
    const url = absoluteUrl(siteUrl, localizedPath(locale, route));
    if (!url) return [];
    languages[locale] = url;
    urls.push(url);
  }

  const xDefault = absoluteUrl(siteUrl, localizedPath('en', route));
  if (!xDefault) return [];
  languages['x-default'] = xDefault;

  return urls.map((url) => ({
    url,
    lastModified,
    changeFrequency: changeFrequencyFor(route),
    priority: priorityFor(route),
    alternates: {languages: {...languages}},
  }));
}

export function minimalSitemapEntries(siteUrl: URL = new URL(FALLBACK_SITE_URL)): MetadataRoute.Sitemap {
  const entries = localizedEntries(siteUrl, '/', fallbackLastModified);
  if (entries.length > 0) return entries;

  return LOCALES.map((locale) => {
    const url = locale === 'es' ? `${FALLBACK_SITE_URL}/es` : `${FALLBACK_SITE_URL}/`;
    return {
      url,
      lastModified: fallbackLastModified,
      changeFrequency: 'weekly' as const,
      priority: 1,
      alternates: {
        languages: {
          en: `${FALLBACK_SITE_URL}/`,
          es: `${FALLBACK_SITE_URL}/es`,
          'x-default': `${FALLBACK_SITE_URL}/`,
        },
      },
    };
  });
}

function readStaticPages(staticPages: readonly StaticSitemapPage[]): readonly StaticSitemapPage[] {
  try {
    return Array.isArray(staticPages) ? staticPages : [];
  } catch {
    return [];
  }
}

function readPublishedLegalPaths(publishedLegalPaths: readonly string[]): ReadonlySet<string> {
  try {
    return new Set(Array.isArray(publishedLegalPaths) ? publishedLegalPaths : []);
  } catch {
    return new Set();
  }
}

/**
 * Builds sitemap entries without throwing.
 * A bad URL is omitted. A bad last-modified falls back to the canonical
 * static date. A failed demo/metadata read keeps the static pages.
 */
export function buildSitemapEntries(input: SitemapBuildInput): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const publishedLegalPaths = readPublishedLegalPaths(input.publishedLegalPaths);

  for (const page of readStaticPages(input.staticPages)) {
    try {
      if (page.publication === 'legal' && !publishedLegalPaths.has(page.path)) continue;
      const lastModified = parseSitemapDate(page.lastModified) ?? fallbackLastModified;
      entries.push(...localizedEntries(input.siteUrl, page.path, lastModified));
    } catch {
      continue;
    }
  }

  let demoRoutes: readonly string[] = [];
  try {
    const routes = input.readIndexableDemoRoutes();
    demoRoutes = Array.isArray(routes) ? routes : [];
  } catch {
    demoRoutes = [];
  }

  let demoLastModified = fallbackLastModified;
  try {
    demoLastModified = parseSitemapDate(input.readDemoLastModified()) ?? fallbackLastModified;
  } catch {
    demoLastModified = fallbackLastModified;
  }

  for (const route of demoRoutes) {
    try {
      entries.push(...localizedEntries(input.siteUrl, route, demoLastModified));
    } catch {
      continue;
    }
  }

  return entries.length > 0 ? entries : minimalSitemapEntries(input.siteUrl);
}

export function buildSitemapEntriesSafely(
  readInput: () => SitemapBuildInput,
): MetadataRoute.Sitemap {
  try {
    const entries = buildSitemapEntries(readInput());
    if (entries.length > 0) return entries;
  } catch (error) {
    console.error('sitemap generation failed; serving minimal sitemap', error);
  }

  try {
    return minimalSitemapEntries(getSiteUrl());
  } catch {
    return minimalSitemapEntries(new URL(FALLBACK_SITE_URL));
  }
}
