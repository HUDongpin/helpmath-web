import type {Metadata} from 'next';

import {ContactFormLoader} from '@/components/contact-form-loader';
import {ContactPage} from '@/components/contact-page';
import {ContactUnavailable} from '@/components/contact-unavailable';
import {MainContent} from '@/components/main-content';
import {getSiteContent} from '@/content';
import {areContactManifestGatesApproved} from '@/lib/launch-gates';
import {isLegalCopyReady} from '@/lib/legal-copy-readiness';
import {createPageMetadata} from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.contact.metadata, '/contact');
}

export default async function ContactRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  const content = getSiteContent(locale).pages.contact;
  const repositoryGateApproved =
    areContactManifestGatesApproved() && isLegalCopyReady();
  const contactSurfaceEnabled =
    repositoryGateApproved &&
    process.env.NEXT_PUBLIC_CONTACT_ENABLED === 'true' &&
    (process.env.NODE_ENV !== 'production' ||
      Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()));

  const form = contactSurfaceEnabled ? (
    <ContactFormLoader
      content={content}
      locale={locale}
      repositoryGateApproved={repositoryGateApproved}
    />
  ) : (
    <ContactUnavailable locale={locale} />
  );

  return (
    <MainContent>
      <ContactPage content={content} form={form} locale={locale} />
    </MainContent>
  );
}
