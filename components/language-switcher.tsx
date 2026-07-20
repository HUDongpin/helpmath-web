'use client';

import {Languages} from 'lucide-react';

import {Link, usePathname} from '@/i18n/navigation';
import type {Locale} from '@/content/types';

export function LanguageSwitcher({
  locale,
  label,
  names
}: {
  locale: Locale;
  label: string;
  names: Record<Locale, string>;
}) {
  const pathname = usePathname();
  const targetLocale: Locale = locale === 'en' ? 'es' : 'en';

  return (
    <Link
      aria-label={`${label}: ${names[targetLocale]}`}
      className="language-switcher"
      href={pathname}
      locale={targetLocale}
    >
      <Languages aria-hidden="true" size={18} />
      <span>{names[targetLocale]}</span>
    </Link>
  );
}
