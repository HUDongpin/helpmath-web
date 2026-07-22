'use client';

import {useSyncExternalStore} from 'react';

import {
  ERROR_RECOVERY_COPY,
  ErrorRecovery,
  errorLocaleFromPathname,
} from '@/components/error-recovery';
import type {Locale} from '@/content/types';

import {nunitoSans} from './fonts';
import './globals.css';

type GlobalErrorProps = {
  error: Error & {digest?: string};
  reset: () => void;
  unstable_retry: () => void;
};

function subscribeToLocation() {
  return () => undefined;
}

function getLocationLocale(): Locale {
  return errorLocaleFromPathname(window.location.pathname);
}

function getServerLocale(): Locale {
  return 'en';
}

export default function GlobalError({unstable_retry}: GlobalErrorProps) {
  const locale = useSyncExternalStore(subscribeToLocation, getLocationLocale, getServerLocale);
  const copy = ERROR_RECOVERY_COPY[locale];
  const homeHref = locale === 'es' ? '/es' : '/';

  return (
    <html lang={locale}>
      <head>
        <title>{copy.documentTitle}</title>
      </head>
      <body className={`${nunitoSans.variable} global-error-body`}>
        <a className="skip-link" href="#main-content">
          {copy.skipToContent}
        </a>
        <header className="global-error-header">
          <div className="container global-error-header__inner">
            <a aria-label={copy.homeLabel} className="brand" href={homeHref}>
              <span aria-hidden="true" className="brand__mark">
                <span>+</span>
                <span>×</span>
              </span>
              <span className="brand__name">
                HELP <strong>Math</strong>
              </span>
            </a>
          </div>
        </header>
        <ErrorRecovery locale={locale} onRetry={unstable_retry} />
      </body>
    </html>
  );
}
