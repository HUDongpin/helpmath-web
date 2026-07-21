import type {MetadataRoute} from 'next';

import {demoIds, indexableDemoIds} from '@/demos/catalog';
import {DEMO_CANDIDATE_IDS} from '@/demos/candidates';
import {getSiteUrl} from '@/lib/site';

type DemoRobotsRule = Readonly<{
  userAgent: '*';
  allow: string[];
  disallow: string[];
}>;

export function buildDemoLifecycleRobotsRule(
  candidateIds: readonly string[],
  lifecyclePublicIds: readonly string[],
  lifecycleIndexableIds: readonly string[],
): DemoRobotsRule {
  const knownCandidateIds = [...new Set(candidateIds)];
  const knownCandidateIdSet = new Set(knownCandidateIds);
  const publicIds = [...new Set(lifecyclePublicIds)].filter((id) =>
    knownCandidateIdSet.has(id),
  );
  const publicIdSet = new Set(publicIds);
  const indexableIds = [...new Set(lifecycleIndexableIds)].filter((id) =>
    publicIdSet.has(id),
  );
  const privateIds = knownCandidateIds.filter((id) => !publicIdSet.has(id));

  return {
    userAgent: '*',
    allow: [
      '/',
      ...indexableIds.map((id) => `/api/executive-preview/assets/${id}/`),
    ],
    disallow: [
      '/api/',
      '/executive-preview',
      '/es/executive-preview',
      ...privateIds.flatMap((id) => [
        `/demos/${id}`,
        `/es/demos/${id}`,
      ]),
      '/flash-assets/',
    ],
  };
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: buildDemoLifecycleRobotsRule(DEMO_CANDIDATE_IDS, demoIds, indexableDemoIds),
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
    host: siteUrl.origin
  };
}
