import type {Metadata} from 'next';

import {ApproachPage} from '@/components/content-pages';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.approach.metadata, '/approach');
}

export default async function ApproachRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <main id="main-content"><ApproachPage content={getSiteContent(locale).pages.approach} /></main>;
}
