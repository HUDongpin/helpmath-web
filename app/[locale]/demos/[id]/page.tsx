import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

import {DemoDetailPage} from '@/components/demos-pages';
import {demoIds, getSiteContent, isLocale, type DemoId} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

function isDemoId(value: string): value is DemoId {
  return demoIds.includes(value as DemoId);
}

export function generateStaticParams() {
  return demoIds.map((id) => ({id}));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}): Promise<Metadata> {
  const {locale, id} = await params;
  if (!isLocale(locale) || !isDemoId(id)) notFound();
  const content = getSiteContent(locale).pages.demoDetails[id];
  return createPageMetadata(locale, content.metadata, `/demos/${id}`);
}

export default async function DemoPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{frame?: string | string[]}>;
}) {
  const [{locale, id}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !isDemoId(id)) notFound();

  const rawFrame = Array.isArray(query.frame) ? query.frame[0] : query.frame;
  const parsedFrame = rawFrame && /^\d+$/.test(rawFrame) ? Number(rawFrame) : undefined;
  const requestedFrame = parsedFrame && Number.isSafeInteger(parsedFrame) && parsedFrame > 0
    ? parsedFrame
    : undefined;

  return (
    <main id="main-content">
      <DemoDetailPage
        content={getSiteContent(locale).pages.demoDetails[id]}
        id={id}
        locale={locale}
        requestedFrame={requestedFrame}
      />
    </main>
  );
}
