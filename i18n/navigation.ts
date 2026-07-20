'use client';

import NextLink from 'next/link';
import {usePathname as useNextPathname} from 'next/navigation';
import {createContext, createElement, useContext, type ComponentProps, type ReactNode} from 'react';

import type {AppLocale} from './routing';

const LocaleContext = createContext<AppLocale>('en');

export function LocaleProvider({children, locale}: {children: ReactNode; locale: AppLocale}) {
  return createElement(LocaleContext.Provider, {value: locale}, children);
}

function localizeHref(href: string, locale: AppLocale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const normalized = stripLocalePrefix(href);
  return locale === 'es' ? (normalized === '/' ? '/es' : `/es${normalized}`) : normalized;
}

function stripLocalePrefix(pathname: string): string {
  for (const locale of ['en', 'es'] as const) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(3) || '/';
  }
  return pathname;
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
