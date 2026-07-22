import type {Metadata} from 'next';

import {LegalPage} from '@/components/content-pages';
import {getSiteContent} from '@/content';
import {isDraftLegalPage} from '@/lib/legal-publishing';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  const metadata = createPageMetadata(locale, getSiteContent(locale).pages.privacy.metadata, '/privacy');
  if (!isDraftLegalPage('privacy')) return metadata;
  return {...metadata, robots: {index: false, follow: true, googleBot: {index: false, follow: true}}};
}

export default async function PrivacyRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <main id="main-content"><LegalPage content={getSiteContent(locale).pages.privacy} /></main>;
}
