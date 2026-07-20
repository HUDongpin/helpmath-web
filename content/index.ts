import { enContent } from "./en";
import { esContent } from "./es";
import type { Locale, SiteContent } from "./types";

export * from "./types";

export const defaultLocale: Locale = "en";
export const supportedLocales = ["en", "es"] as const satisfies readonly Locale[];

export const siteContent: Readonly<Record<Locale, SiteContent>> = {
  en: enContent,
  es: esContent,
};

export function isLocale(value: string | null | undefined): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "es" || normalized?.startsWith("es-")) {
    return "es";
  }

  return defaultLocale;
}

export function getSiteContent(locale?: string | null): SiteContent {
  return siteContent[normalizeLocale(locale)];
}

export function getPageContent<Key extends keyof SiteContent["pages"]>(
  locale: string | null | undefined,
  page: Key,
): SiteContent["pages"][Key] {
  return getSiteContent(locale).pages[page];
}
