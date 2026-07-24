import type {AppLocale} from './routing';

function splitLocalHref(href: string): {pathname: string; suffix: string} {
  const suffixIndex = href.search(/[?#]/);

  if (suffixIndex === -1) {
    return {pathname: href, suffix: ''};
  }

  return {
    pathname: href.slice(0, suffixIndex) || '/',
    suffix: href.slice(suffixIndex),
  };
}

export function stripLocalePrefix(href: string): string {
  const {pathname, suffix} = splitLocalHref(href);

  for (const locale of ['en', 'es'] as const) {
    if (pathname === `/${locale}`) return `/${suffix}`;
    if (pathname.startsWith(`/${locale}/`)) {
      return `${pathname.slice(3) || '/'}${suffix}`;
    }
  }

  return `${pathname}${suffix}`;
}

export function localizeHref(href: string, locale: AppLocale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const {pathname, suffix} = splitLocalHref(stripLocalePrefix(href));
  const localizedPathname =
    locale === 'es' ? (pathname === '/' ? '/es' : `/es${pathname}`) : pathname;

  return `${localizedPathname}${suffix}`;
}

export function languageSwitchGatewayHref(
  pathname: string,
  locale: AppLocale,
): string {
  const localPathname = stripLocalePrefix(pathname).split(/[?#]/, 1)[0] || '/';

  return `/api/language-switch/${locale}?path=${encodeURIComponent(localPathname)}`;
}
