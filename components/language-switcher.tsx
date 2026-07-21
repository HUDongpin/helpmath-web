'use client';

import {Languages} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {Suspense, useSyncExternalStore} from 'react';

import {Link, usePathname} from '@/i18n/navigation';
import type {Locale} from '@/content/types';

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  names: Record<Locale, string>;
  onNavigate?: () => void;
  pathnameOverride?: string;
};

function subscribeToHashChange(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
}

function getHash(): string {
  return window.location.hash;
}

function getServerHash(): string {
  return '';
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
    <Link
      aria-label={`${label}: ${names[targetLocale]}`}
      className="language-switcher"
      href={href}
      locale={targetLocale}
      onClick={onNavigate}
      prefetch={false}
    >
      <Languages aria-hidden="true" size={18} />
      <span>{names[targetLocale]}</span>
    </Link>
  );
}

function LanguageSwitcherWithLocation({
  pathname,
  ...props
}: LanguageSwitcherProps & {pathname: string}) {
  const searchParams = useSearchParams();
  const hash = useSyncExternalStore(subscribeToHashChange, getHash, getServerHash);
  const query = searchParams.toString();
  const href = `${pathname}${query ? `?${query}` : ''}${hash}`;

  return <SwitcherLink href={href} {...props} />;
}

export function LanguageSwitcher({pathnameOverride, ...props}: LanguageSwitcherProps) {
  const currentPathname = usePathname();
  const pathname = pathnameOverride ?? currentPathname;

  return (
    <Suspense fallback={<SwitcherLink href={pathname} {...props} />}>
      <LanguageSwitcherWithLocation pathname={pathname} {...props} />
    </Suspense>
  );
}
