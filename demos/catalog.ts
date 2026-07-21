import {
  DEMO_CANDIDATE_IDS,
  type DemoCandidateId,
} from './candidates';
import {
  isDemoIndexable as lifecycleIsDemoIndexable,
  isDemoPrivatePreview,
  isDemoPublic,
} from '../lib/demo-lifecycle';

export type DemoId = DemoCandidateId;

export const demoIds = Object.freeze(
  DEMO_CANDIDATE_IDS.filter((id) => isDemoPublic(id)),
) as readonly DemoId[];

export const demoRoutes = Object.freeze(demoIds.map((id) => `/demos/${id}` as const));

export const reviewDemoIds = Object.freeze(
  DEMO_CANDIDATE_IDS.filter((id) => isDemoPrivatePreview(id)),
) as readonly DemoId[];

export const reviewDemoRoutes = Object.freeze(
  reviewDemoIds.map((id) => `/demos/${id}` as const),
);

export const indexableDemoIds = Object.freeze(
  DEMO_CANDIDATE_IDS.filter((id) => lifecycleIsDemoIndexable(id)),
) as readonly DemoId[];

export const indexableDemoRoutes = Object.freeze(
  indexableDemoIds.map((id) => `/demos/${id}` as const),
);

export function isDemoId(value: string): value is DemoId {
  return demoIds.some((id) => id === value);
}

export function isReviewDemoId(value: string): value is DemoId {
  return reviewDemoIds.some((id) => id === value);
}

export function isIndexableDemo(value: DemoId): boolean {
  return indexableDemoIds.some((id) => id === value);
}
