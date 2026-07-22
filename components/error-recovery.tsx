'use client';

import {ArrowLeft, LifeBuoy, RotateCw, ShieldCheck} from 'lucide-react';
import {useEffect, useRef} from 'react';

import type {Locale} from '@/content/types';

type ErrorRecoveryCopy = {
  documentTitle: string;
  eyebrow: string;
  title: string;
  body: string;
  privacy: string;
  retry: string;
  home: string;
  support: string;
  skipToContent: string;
  homeLabel: string;
};

export const ERROR_RECOVERY_COPY: Record<Locale, ErrorRecoveryCopy> = {
  en: {
    documentTitle: 'Page temporarily unavailable · HELP Math',
    eyebrow: 'Temporary interruption',
    title: 'This page could not load',
    body:
      'HELP Math encountered an unexpected problem. Try loading the page again, or return to a safe starting point.',
    privacy: 'For your privacy, technical error details are not displayed here.',
    retry: 'Try again',
    home: 'Return home',
    support: 'Get support',
    skipToContent: 'Skip to recovery options',
    homeLabel: 'HELP Math home',
  },
  es: {
    documentTitle: 'Página temporalmente no disponible · HELP Math',
    eyebrow: 'Interrupción temporal',
    title: 'No se pudo cargar esta página',
    body:
      'HELP Math encontró un problema inesperado. Intenta cargar la página de nuevo o vuelve a un punto de partida seguro.',
    privacy: 'Para proteger tu privacidad, aquí no se muestran detalles técnicos del error.',
    retry: 'Intentar de nuevo',
    home: 'Volver al inicio',
    support: 'Obtener ayuda',
    skipToContent: 'Ir a las opciones de recuperación',
    homeLabel: 'Inicio de HELP Math',
  },
};

export function errorLocaleFromPathname(pathname: string): Locale {
  return /^\/es(?:\/|$)/u.test(pathname) ? 'es' : 'en';
}

export function ErrorRecovery({
  locale,
  onRetry,
}: {
  locale: Locale;
  onRetry: () => void;
}) {
  const copy = ERROR_RECOVERY_COPY[locale];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const homeHref = locale === 'es' ? '/es' : '/';
  const supportHref = locale === 'es' ? '/es/support' : '/support';

  useEffect(() => {
    headingRef.current?.focus({preventScroll: true});
  }, []);

  return (
    <main className="error-recovery" id="main-content">
      <div className="container error-recovery__inner">
        <section
          aria-describedby="error-recovery-description error-recovery-privacy"
          aria-labelledby="error-recovery-title"
          className="error-recovery__card"
        >
          <div aria-hidden="true" className="error-recovery__symbol">
            <span>+</span>
            <span>×</span>
          </div>
          <div className="error-recovery__copy">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 id="error-recovery-title" ref={headingRef} tabIndex={-1}>
              {copy.title}
            </h1>
            <p id="error-recovery-description">{copy.body}</p>
            <div className="error-recovery__actions">
              <button className="action action--primary" onClick={onRetry} type="button">
                <RotateCw aria-hidden="true" size={18} strokeWidth={2.4} />
                <span>{copy.retry}</span>
              </button>
              <a className="action action--secondary" href={homeHref}>
                <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.4} />
                <span>{copy.home}</span>
              </a>
              <a className="action action--quiet" href={supportHref}>
                <LifeBuoy aria-hidden="true" size={18} strokeWidth={2.4} />
                <span>{copy.support}</span>
              </a>
            </div>
            <p className="error-recovery__privacy" id="error-recovery-privacy">
              <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.2} />
              <span>{copy.privacy}</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
