import conversion12 from './conversion-1-2.json';
import conversion14 from './conversion-1-4.json';

import type {DemoCandidate} from '../../lib/demo-lifecycle-validation';

export const DEMO_CANDIDATE_IDS = Object.freeze([
  'conversion-1-2',
  'conversion-1-4',
] as const);

export type DemoCandidateId = (typeof DEMO_CANDIDATE_IDS)[number];

export const demoCandidates = Object.freeze({
  'conversion-1-2': conversion12 as unknown as DemoCandidate,
  'conversion-1-4': conversion14 as unknown as DemoCandidate,
}) satisfies Readonly<Record<DemoCandidateId, DemoCandidate>>;

export function isDemoCandidateId(value: string): value is DemoCandidateId {
  return DEMO_CANDIDATE_IDS.some((id) => id === value);
}
