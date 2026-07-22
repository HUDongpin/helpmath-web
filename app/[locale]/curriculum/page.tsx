import type {Metadata} from 'next';

import {CurriculumPage} from '@/components/content-pages';
import {MainContent} from '@/components/main-content';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.curriculum.metadata, '/curriculum');
}

export default async function CurriculumRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <MainContent><CurriculumPage content={getSiteContent(locale).pages.curriculum} /></MainContent>;
}
