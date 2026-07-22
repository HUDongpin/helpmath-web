import type {Metadata} from 'next';

import {AboutPage} from '@/components/content-pages';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: 'en' | 'es'}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.about.metadata, '/about');
}

export default async function AboutRoute({
  params,
}: {
  params: Promise<{locale: 'en' | 'es'}>;
}) {
  const {locale} = await params;
  return (
    <main id="main-content">
      <AboutPage content={getSiteContent(locale).pages.about} />
    </main>
  );
}
