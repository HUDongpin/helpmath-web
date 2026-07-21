'use client';

import NextLink from 'next/link';
import {usePathname as useNextPathname} from 'next/navigation';
import {createContext, createElement, useContext, type ComponentProps, type ReactNode} from 'react';

import type {AppLocale} from './routing';

const LocaleContext = createContext<AppLocale>('en');

export function LocaleProvider({children, locale}: {children: ReactNode; locale: AppLocale}) {
  return createElement(LocaleContext.Provider, {value: locale}, children);
}

export function useLocale(): AppLocale {
  return useContext(LocaleContext);
}

function localizeHref(href: string, locale: AppLocale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const {pathname, suffix} = splitLocalHref(stripLocalePrefix(href));
  const localizedPathname =
    locale === 'es' ? (pathname === '/' ? '/es' : `/es${pathname}`) : pathname;

  return `${localizedPathname}${suffix}`;
}

function splitLocalHref(href: string): {pathname: string; suffix: string} {
  const suffixIndex = href.search(/[?#]/);

  if (suffixIndex === -1) {
    return {pathname: href, suffix: ''};
  }

  return {
    pathname: href.slice(0, suffixIndex) || '/',
    suffix: href.slice(suffixIndex)
  };
}

export function stripLocalePrefix(href: string): string {
  const {pathname, suffix} = splitLocalHref(href);

  for (const locale of ['en', 'es'] as const) {
    if (pathname === `/${locale}`) return `/${suffix}`;
    if (pathname.startsWith(`/${locale}/`)) return `${pathname.slice(3) || '/'}${suffix}`;
  }

  return `${pathname}${suffix}`;
}

type LocalizedLinkProps = Omit<ComponentProps<typeof NextLink>, 'href' | 'locale'> & {
  href: string;
  locale?: AppLocale;
};

export function Link({href, locale, ...props}: LocalizedLinkProps) {
  const activeLocale = useContext(LocaleContext);
  return createElement(NextLink, {href: localizeHref(href, locale ?? activeLocale), ...props});
}

export function usePathname(): string {
  return stripLocalePrefix(useNextPathname());
}
