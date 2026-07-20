export const routing = Object.freeze({
  locales: ['en', 'es'] as const,
  defaultLocale: 'en' as const,
  localeDetection: false,
  localePrefix: 'as-needed' as const
});

export type AppLocale = (typeof routing.locales)[number];
