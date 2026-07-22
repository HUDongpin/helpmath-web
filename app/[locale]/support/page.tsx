import type {Metadata} from 'next';

import {SupportPage} from '@/components/content-pages';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.support.metadata, '/support');
}

export default async function SupportRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <main id="main-content"><SupportPage content={getSiteContent(locale).pages.support} /></main>;
}
