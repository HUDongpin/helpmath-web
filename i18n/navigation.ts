'use client';

import NextLink from 'next/link';
import {usePathname as useNextPathname} from 'next/navigation';
import {createElement, type ComponentProps} from 'react';

import type {AppLocale} from './routing';
import {localizeHref, stripLocalePrefix} from './href';
import {useLocale} from './locale-context';

type LocalizedLinkProps = Omit<ComponentProps<typeof NextLink>, 'href' | 'locale'> & {
  href: string;
  locale?: AppLocale;
};

export function Link({href, locale, prefetch = false, ...props}: LocalizedLinkProps) {
  const activeLocale = useLocale();

  // The information architecture exposes many repeated header, footer, and
  // card links at once. Fetch on navigation by default so an initial page view
  // does not eagerly request every linked RSC payload; callers can opt in.
  return createElement(NextLink, {
    href: localizeHref(href, locale ?? activeLocale),
    prefetch,
    ...props,
  });
}

export function usePathname(): string {
  return stripLocalePrefix(useNextPathname());
}
