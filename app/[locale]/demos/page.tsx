import type {Metadata} from 'next';

import {DemosPage} from '@/components/demos-pages';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.demos.metadata, '/demos');
}

export default async function DemosRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <main id="main-content"><DemosPage content={getSiteContent(locale).pages.demos} /></main>;
}
