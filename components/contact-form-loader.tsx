'use client';

import {lazy, Suspense} from 'react';

import type {ContactContent, Locale} from '@/content/types';

import {ContactUnavailable} from './contact-unavailable';

const ContactForm = lazy(() =>
  import('./contact-form').then((module) => ({default: module.ContactForm})),
);

export function ContactFormLoader({
  content,
  locale,
  repositoryGateApproved,
}: {
  content: ContactContent;
  locale: Locale;
  repositoryGateApproved: boolean;
}) {
  const contactEnabled =
    repositoryGateApproved && process.env.NEXT_PUBLIC_CONTACT_ENABLED === 'true';

  // Do not render the lazy boundary while intake is closed. This keeps the
  // Turnstile/form chunk out of the initial contact-page download, while the
  // reviewed gate manifest and public environment flag still activate it.
  if (!contactEnabled) return <ContactUnavailable locale={locale} />;

  return (
    <Suspense
      fallback={
        <div aria-live="polite" className="demo-unavailable" role="status">
          <p>
            {locale === 'es'
              ? 'Cargando el formulario de contacto seguro…'
              : 'Loading the secure contact form…'}
          </p>
        </div>
      }
    >
      <ContactForm
        content={content}
        locale={locale}
        repositoryGateApproved={repositoryGateApproved}
      />
    </Suspense>
  );
}
