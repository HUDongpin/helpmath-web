import snapshot from './SNAPSHOT.json';

export type DemoId = keyof typeof snapshot.sources;

type SnapshotSource = (typeof snapshot.sources)[DemoId];
const sourceEntries = Object.entries(snapshot.sources) as Array<[DemoId, SnapshotSource]>;

export const demoIds = Object.freeze(
  sourceEntries
    .filter(([, source]) =>
      source.public &&
      source.publication.access === 'public-preview' &&
      source.publication.rightsApproval === 'approved'
    )
    .map(([id]) => id),
) as readonly DemoId[];

export const demoRoutes = Object.freeze(demoIds.map((id) => `/demos/${id}` as const));

export const reviewDemoIds = Object.freeze(
  sourceEntries
    .filter(([, source]) =>
      !source.public &&
      source.publication.access === 'private' &&
      !source.publication.indexable &&
      source.publication.internalExecutiveReview === 'approved'
    )
    .map(([id]) => id),
) as readonly DemoId[];

export const reviewDemoRoutes = Object.freeze(
  reviewDemoIds.map((id) => `/demos/${id}` as const),
);

export const indexableDemoIds = Object.freeze(
  sourceEntries
    .filter(([, source]) =>
      source.public &&
      source.validationStatus === 'strict-complete' &&
      source.publication.indexable &&
      source.publication.technicalAcceptance === 'approved' &&
      source.publication.rightsApproval === 'approved'
    )
    .map(([id]) => id),
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
