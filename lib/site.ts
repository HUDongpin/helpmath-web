export const SITE_NAME = 'HELP Math';
export const SITE_DESCRIPTION =
  'Interactive, language-rich mathematics learning for multilingual students and the educators who support them.';

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
