import type {Locale} from '@/content/types';

import {MainContent} from './main-content';
import {Container} from './ui';

export function NotFoundPage({locale}: {locale: Locale}) {
  const content = locale === 'es'
    ? {
        title: 'Página no encontrada',
        body: 'La página solicitada no forma parte del sitio web de HELP Math.',
        action: 'Volver al inicio',
        href: '/es',
      }
    : {
        title: 'Page not found',
        body: 'The page you requested is not part of the HELP Math website.',
        action: 'Return home',
        href: '/',
      };

  return (
    <MainContent className="page-hero page-hero--yellow">
      <Container>
        <div className="page-hero__copy">
          <p className="eyebrow">404</p>
          <h1>{content.title}</h1>
          <p>{content.body}</p>
          <div className="page-hero__actions">
            <a className="action action--primary" href={content.href}>
              {content.action}
            </a>
          </div>
        </div>
      </Container>
    </MainContent>
  );
}
