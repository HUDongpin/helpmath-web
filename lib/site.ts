export const SITE_NAME = 'HELP Math';
export const SITE_DESCRIPTIONS = {
  en: 'HELP Math project information: HELP Math 1.0 history and research, language-rich mathematics design, and the proposed HELP Math 2.0 modernization.',
  es: 'Información del proyecto HELP Math: historia e investigación de HELP Math 1.0, diseño matemático con apoyo lingüístico y la modernización propuesta de HELP Math 2.0.',
} as const;
export const SITE_DESCRIPTION = SITE_DESCRIPTIONS.en;

const fallbackUrl = 'https://www.helpmath.ai';

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    return new URL(configured || fallbackUrl);
  } catch {
    return new URL(fallbackUrl);
  }
}

export function localizedPath(locale: 'en' | 'es', path = '/'): string {
  const normalized = path === '/' ? '' : path;
  return locale === 'es' ? `/es${normalized || ''}` || '/es' : normalized || '/';
}
