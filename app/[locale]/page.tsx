import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

import {HomePage} from '@/components/home-page';
import {getSiteContent, isLocale} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return createPageMetadata(locale, getSiteContent(locale).pages.home.metadata);
}

export default async function Home({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main id="main-content">
      <HomePage content={getSiteContent(locale).pages.home} locale={locale} />
    </main>
  );
}
