import type {Metadata} from 'next';

import {ResearchPage} from '@/components/content-pages';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.research.metadata, '/research');
}

export default async function ResearchRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <main id="main-content"><ResearchPage content={getSiteContent(locale).pages.research} /></main>;
}
