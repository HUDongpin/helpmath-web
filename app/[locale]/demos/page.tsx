import type {Metadata} from 'next';

import {DemosPage} from '@/components/demos-page';
import {MainContent} from '@/components/main-content';
import {getRuntimeSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(
    locale,
    getRuntimeSiteContent(locale).pages.demos.metadata,
    '/demos',
  );
}

export default async function DemosRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return (
    <MainContent>
      <DemosPage content={getRuntimeSiteContent(locale).pages.demos} locale={locale} />
    </MainContent>
  );
}
