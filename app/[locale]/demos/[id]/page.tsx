import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

import {DemoDetailPage} from '@/components/demos-pages';
import {MainContent} from '@/components/main-content';
import {demoIds, getSiteContent, isDemoId, isLocale} from '@/content';
import {isIndexableDemo, isReviewDemoId, reviewDemoIds} from '@/demos/catalog';
import {hasExecutivePreviewSession} from '@/lib/executive-preview-server';
import {createPageMetadata} from '@/lib/metadata';

export function generateStaticParams() {
  return [...demoIds, ...reviewDemoIds].map((id) => ({id}));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}): Promise<Metadata> {
  const {locale, id} = await params;
  if (!isLocale(locale) || (!isDemoId(id) && !isReviewDemoId(id))) notFound();
  if (isReviewDemoId(id) && !(await hasExecutivePreviewSession())) notFound();
  const content = getSiteContent(locale).pages.demoDetails[id];
  const metadata = createPageMetadata(locale, content.metadata, `/demos/${id}`);
  if (isDemoId(id) && isIndexableDemo(id)) return metadata;

  return {
    ...metadata,
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      googleBot: {index: false, follow: false, noarchive: true},
    },
  };
}

export default async function DemoPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{frame?: string | string[]}>;
}) {
  const [{locale, id}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || (!isDemoId(id) && !isReviewDemoId(id))) notFound();
  if (isReviewDemoId(id) && !(await hasExecutivePreviewSession())) notFound();

  const rawFrame = Array.isArray(query.frame) ? query.frame[0] : query.frame;
  const parsedFrame = rawFrame && /^\d+$/.test(rawFrame) ? Number(rawFrame) : undefined;
  const requestedFrame = parsedFrame && Number.isSafeInteger(parsedFrame) && parsedFrame > 0
    ? parsedFrame
    : undefined;

  return (
    <MainContent>
      <DemoDetailPage
        content={getSiteContent(locale).pages.demoDetails[id]}
        id={id}
        locale={locale}
        requestedFrame={requestedFrame}
        reviewMode={isReviewDemoId(id)}
      />
    </MainContent>
  );
}
