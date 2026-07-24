import type {Metadata} from 'next';

import {LegalPage} from '@/components/content-pages';
import {MainContent} from '@/components/main-content';
import {getSiteContent} from '@/content';
import {isDraftLegalPage} from '@/lib/legal-publishing';
import {createPageMetadata} from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  const metadata = createPageMetadata(locale, getSiteContent(locale).pages.terms.metadata, '/terms');
  if (!isDraftLegalPage('terms')) return metadata;
  return {...metadata, robots: {index: false, follow: true, googleBot: {index: false, follow: true}}};
}

export default async function TermsRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <MainContent><LegalPage content={getSiteContent(locale).pages.terms} locale={locale} /></MainContent>;
}
