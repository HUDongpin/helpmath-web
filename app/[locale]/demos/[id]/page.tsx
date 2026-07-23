import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

import {DemoDetailPage} from '@/components/demos-pages';
import {MainContent} from '@/components/main-content';
import {getRuntimeSiteContent, isLocale} from '@/content';
import {DEMO_CANDIDATE_IDS, isDemoCandidateId} from '@/demos/candidates';
import {getDemoLifecycleState} from '@/lib/demo-lifecycle';
import {hasExecutivePreviewSession} from '@/lib/executive-preview-server';
import {createPageMetadata} from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return DEMO_CANDIDATE_IDS.map((id) => ({id}));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}): Promise<Metadata> {
  const {locale, id} = await params;
  if (!isLocale(locale) || !isDemoCandidateId(id)) notFound();
  const lifecycle = getDemoLifecycleState(id);
  if (!lifecycle.public && !lifecycle.privatePreview) notFound();
  if (!lifecycle.public && !(await hasExecutivePreviewSession())) notFound();
  const content = getRuntimeSiteContent(locale).pages.demoDetails[id];
  const metadata = createPageMetadata(locale, content.metadata, `/demos/${id}`);
  if (lifecycle.public && lifecycle.indexable) return metadata;

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
  if (!isLocale(locale) || !isDemoCandidateId(id)) notFound();
  const lifecycle = getDemoLifecycleState(id);
  if (!lifecycle.public && !lifecycle.privatePreview) notFound();
  if (!lifecycle.public && !(await hasExecutivePreviewSession())) notFound();

  const rawFrame = Array.isArray(query.frame) ? query.frame[0] : query.frame;
  const parsedFrame = rawFrame && /^\d+$/.test(rawFrame) ? Number(rawFrame) : undefined;
  const requestedFrame = parsedFrame && Number.isSafeInteger(parsedFrame) && parsedFrame > 0
    ? parsedFrame
    : undefined;

  return (
    <MainContent>
      <DemoDetailPage
        content={getRuntimeSiteContent(locale).pages.demoDetails[id]}
        id={id}
        locale={locale}
        requestedFrame={requestedFrame}
        reviewMode={!lifecycle.public}
      />
    </MainContent>
  );
}
