'use client';

import {usePathname} from 'next/navigation';
import {useSyncExternalStore} from 'react';

import type {Locale} from '@/content/types';
import {BROWSER_LOCATION_CHANGE_EVENT} from '@/i18n/browser-location';
import {
  languageSwitchGatewayHref,
  localizeHref,
  stripLocalePrefix,
} from '@/i18n/href';

import {Languages} from './server-icons';

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  names: Record<Locale, string>;
  onNavigate?: () => void;
  pathnameOverride?: string;
};

function subscribeToLocationChange(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener(BROWSER_LOCATION_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener(BROWSER_LOCATION_CHANGE_EVENT, onStoreChange);
  };
}

function getLocationSuffix(): string | null {
  return `${window.location.search}${window.location.hash}`;
}

function getServerLocationSuffix(): string | null {
  return null;
}

function SwitcherLink({
  href,
  locale,
  label,
  names,
  onNavigate
}: LanguageSwitcherProps & {href: string}) {
  const targetLocale: Locale = locale === 'en' ? 'es' : 'en';

  return (
    <a
      aria-label={`${label}: ${names[targetLocale]}`}
      className="language-switcher"
      href={href}
      onClick={onNavigate}
    >
      <Languages aria-hidden="true" size={18} />
      <span>{names[targetLocale]}</span>
    </a>
  );
}

function LanguageSwitcherWithLocation({
  pathname,
  ...props
}: LanguageSwitcherProps & {pathname: string}) {
  const locationSuffix = useSyncExternalStore(
    subscribeToLocationChange,
    getLocationSuffix,
    getServerLocationSuffix,
  );
  const targetLocale: Locale = props.locale === 'en' ? 'es' : 'en';
  const href = locationSuffix === null
    ? languageSwitchGatewayHref(pathname, targetLocale)
    : `${pathname}${locationSuffix}`;

  return (
    <SwitcherLink
      href={locationSuffix === null ? href : localizeHref(href, targetLocale)}
      {...props}
    />
  );
}

export function LanguageSwitcher({pathnameOverride, ...props}: LanguageSwitcherProps) {
  const currentPathname = stripLocalePrefix(usePathname());
  const pathname = pathnameOverride ?? currentPathname;

  return <LanguageSwitcherWithLocation pathname={pathname} {...props} />;
}
