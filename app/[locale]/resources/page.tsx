import type {Metadata} from 'next';

import {MainContent} from '@/components/main-content';
import {ResourcesPage} from '@/components/resources-page';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.resources.metadata, '/resources');
}

export default async function ResourcesRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <MainContent><ResourcesPage content={getSiteContent(locale).pages.resources} locale={locale} /></MainContent>;
}
