/* eslint-disable @next/next/no-html-link-for-pages -- Native links keep this recovery page usable without the Next browser runtime. */
import Head from 'next/head';

import {MainContent} from './main-content';

export type PagesErrorKind = 'not-found' | 'unavailable';

type LocalizedErrorCopy = {
  body: string;
  home: string;
  privacy: string;
  support: string;
  title: string;
};

type PagesErrorCopy = {
  documentTitle: string;
  eyebrow: '404' | '500';
  en: LocalizedErrorCopy;
  es: LocalizedErrorCopy;
};

export const PAGES_ERROR_COPY: Record<PagesErrorKind, PagesErrorCopy> = {
  'not-found': {
    documentTitle: 'Page not found / Página no encontrada · HELP Math',
    eyebrow: '404',
    en: {
      title: 'Page not found',
      body: 'The page you requested is not part of the HELP Math website.',
      home: 'Return home',
      support: 'Get support',
      privacy: 'No account, request, or technical error details are displayed on this page.',
    },
    es: {
      title: 'Página no encontrada',
      body: 'La página solicitada no forma parte del sitio web de HELP Math.',
      home: 'Volver al inicio',
      support: 'Obtener ayuda',
      privacy: 'Esta página no muestra datos de cuentas, solicitudes ni detalles técnicos del error.',
    },
  },
  unavailable: {
    documentTitle: 'Page temporarily unavailable / Página temporalmente no disponible · HELP Math',
    eyebrow: '500',
    en: {
      title: 'This page could not load',
      body: 'HELP Math encountered an unexpected problem. Return to a safe starting point or contact support.',
      home: 'Return home',
      support: 'Get support',
      privacy: 'For your privacy, technical error details are not displayed here.',
    },
    es: {
      title: 'No se pudo cargar esta página',
      body: 'HELP Math encontró un problema inesperado. Vuelve a un punto de partida seguro o solicita ayuda.',
      home: 'Volver al inicio',
      support: 'Obtener ayuda',
      privacy: 'Para proteger tu privacidad, aquí no se muestran detalles técnicos del error.',
    },
  },
};

export function PagesErrorPage({kind}: {kind: PagesErrorKind}) {
  const copy = PAGES_ERROR_COPY[kind];

  return (
    <>
      <Head>
        <title>{copy.documentTitle}</title>
        <meta content="noindex, nofollow, noarchive" name="robots" />
        <meta content="noindex, nofollow, noarchive" name="googlebot" />
      </Head>
      <div className="global-error-body" data-pages-error={copy.eyebrow}>
        <a className="skip-link" href="#main-content">
          Skip to recovery options / Ir a las opciones de recuperación
        </a>
        <header className="global-error-header">
          <div className="container global-error-header__inner">
            <a aria-label="HELP Math home / Inicio de HELP Math" className="brand" href="/">
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
        <MainContent className="error-recovery">
          <div className="container error-recovery__inner">
            <section
              aria-describedby="pages-error-description-en pages-error-description-es pages-error-privacy-en pages-error-privacy-es"
              aria-labelledby="pages-error-title"
              className="error-recovery__card"
            >
              <div aria-hidden="true" className="error-recovery__symbol">
                <span>{copy.eyebrow}</span>
              </div>
              <div className="error-recovery__copy">
                <p className="eyebrow">HELP Math</p>
                <h1 id="pages-error-title">
                  <span lang="en">{copy.en.title}</span>
                  <span aria-hidden="true"> / </span>
                  <span lang="es">{copy.es.title}</span>
                </h1>
                <p id="pages-error-description-en" lang="en">{copy.en.body}</p>
                <p id="pages-error-description-es" lang="es">{copy.es.body}</p>
                <div className="error-recovery__actions">
                  <a className="action action--primary" href="/" lang="en">
                    {copy.en.home}
                  </a>
                  <a className="action action--secondary" href="/es" lang="es">
                    {copy.es.home}
                  </a>
                  <a className="action action--quiet" href="/support" lang="en">
                    {copy.en.support}
                  </a>
                  <a className="action action--quiet" href="/es/support" lang="es">
                    {copy.es.support}
                  </a>
                </div>
                <p className="error-recovery__privacy" id="pages-error-privacy-en" lang="en">
                  {copy.en.privacy}
                </p>
                <p className="error-recovery__privacy" id="pages-error-privacy-es" lang="es">
                  {copy.es.privacy}
                </p>
              </div>
            </section>
          </div>
        </MainContent>
      </div>
    </>
  );
}
