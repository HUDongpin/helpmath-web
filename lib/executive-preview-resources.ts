import path from 'node:path';

import {demoIds, reviewDemoIds, type DemoId} from '@/demos/catalog';
import {DEMO_CANDIDATE_IDS, demoCandidates} from '@/demos/candidates';
import {getDemoLifecycleCatalog} from '@/lib/demo-lifecycle';

export const EXECUTIVE_PREVIEW_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export const PUBLIC_DEMO_RESOURCE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
} as const;

export const PUBLIC_DEMO_ASSET_HEADERS = PUBLIC_DEMO_RESOURCE_HEADERS;

export const EXECUTIVE_PREVIEW_RUNTIME_FILES: Readonly<Record<string, string>> =
  Object.freeze(Object.fromEntries(
    DEMO_CANDIDATE_IDS.map((id) => [`${id}.js`, `${id}.js`]),
  ));

export const EXECUTIVE_PREVIEW_RUNTIME_OWNERS: Readonly<Record<string, DemoId>> =
  Object.freeze(Object.fromEntries(
    DEMO_CANDIDATE_IDS.map((id) => [`${id}.js`, id]),
  ));

const PRIVATE_ASSET_PREFIX = 'private-demo-assets/';

const assetDemoIds = Object.freeze(
  [...new Set([...reviewDemoIds, ...demoIds])],
) as readonly DemoId[];

const assetEntries = assetDemoIds.flatMap((id) => {
  const ownedAssetPrefix = `${PRIVATE_ASSET_PREFIX}${id}/`;
  return demoCandidates[id].artifacts
    .map(({path: artifactPath}) => artifactPath)
    .filter((artifactPath) => artifactPath.startsWith(ownedAssetPrefix))
    .map((artifactPath) => {
      const privatePath = artifactPath.slice(PRIVATE_ASSET_PREFIX.length);
      return {id, privatePath} as const;
    });
});

export const EXECUTIVE_PREVIEW_ASSET_FILES: Readonly<Record<string, string>> =
  Object.freeze(Object.fromEntries(
    assetEntries.map(({privatePath}) => [privatePath, privatePath] as const),
  ));

export const EXECUTIVE_PREVIEW_ASSET_OWNERS: Readonly<Record<string, DemoId>> =
  Object.freeze(Object.fromEntries(
    assetEntries.map(({id, privatePath}) => [privatePath, id] as const),
  ));

type ReadPrivateFile = (absolutePath: string) => Promise<Uint8Array>;

type ServeExecutivePreviewResourceOptions = {
  authorized: boolean;
  contentType: string;
  files: Readonly<Record<string, string>>;
  headOnly: boolean;
  readFile: ReadPrivateFile;
  requestKey: string;
  root: string;
};

type ServeExecutivePreviewAssetOptions = Omit<
  ServeExecutivePreviewResourceOptions,
  'contentType' | 'files'
> & {
  publicDemoIds?: readonly DemoId[];
};

type ServeExecutivePreviewRuntimeOptions = Omit<
  ServeExecutivePreviewResourceOptions,
  'contentType' | 'files'
> & {
  publicDemoIds?: readonly DemoId[];
};

function closedResponse(status = 404) {
  return new Response(null, {status, headers: EXECUTIVE_PREVIEW_PRIVATE_HEADERS});
}

type ServeAllowlistedResourceOptions = Omit<
  ServeExecutivePreviewResourceOptions,
  'authorized'
> & {
  accessGranted: boolean;
  responseHeaders: Readonly<Record<string, string>>;
};

async function serveAllowlistedResource({
  accessGranted,
  contentType,
  files,
  headOnly,
  readFile,
  requestKey,
  responseHeaders,
  root,
}: ServeAllowlistedResourceOptions): Promise<Response> {
  if (!accessGranted || !Object.hasOwn(files, requestKey)) return closedResponse();

  const resolvedRoot = path.resolve(root);
  const file = files[requestKey];
  if (!file) return closedResponse();
  const absolutePath = path.resolve(resolvedRoot, file);
  const relativePath = path.relative(resolvedRoot, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return closedResponse();

  try {
    const bytes = await readFile(absolutePath);
    const body = headOnly ? null : new Uint8Array(bytes).buffer;
    return new Response(body, {
      status: 200,
      headers: {
        ...responseHeaders,
        'Content-Length': String(bytes.byteLength),
        'Content-Type': contentType,
      },
    });
  } catch {
    return closedResponse(503);
  }
}

export async function serveExecutivePreviewResource({
  authorized,
  contentType,
  files,
  headOnly,
  readFile,
  requestKey,
  root,
}: ServeExecutivePreviewResourceOptions): Promise<Response> {
  return serveAllowlistedResource({
    accessGranted: authorized,
    contentType,
    files,
    headOnly,
    readFile,
    requestKey,
    responseHeaders: EXECUTIVE_PREVIEW_PRIVATE_HEADERS,
    root,
  });
}

export function isExecutivePreviewAssetPublic(
  requestKey: string,
  publicDemoIds: readonly DemoId[] = getDemoLifecycleCatalog().publicIds,
): boolean {
  const owner = EXECUTIVE_PREVIEW_ASSET_OWNERS[requestKey];
  return Boolean(owner && publicDemoIds.some((id) => id === owner));
}

export async function serveExecutivePreviewAsset({
  authorized,
  headOnly,
  publicDemoIds = getDemoLifecycleCatalog().publicIds,
  readFile,
  requestKey,
  root,
}: ServeExecutivePreviewAssetOptions): Promise<Response> {
  const publiclyAccessible = isExecutivePreviewAssetPublic(requestKey, publicDemoIds);
  return serveAllowlistedResource({
    accessGranted: authorized || publiclyAccessible,
    contentType: 'image/png',
    files: EXECUTIVE_PREVIEW_ASSET_FILES,
    headOnly,
    readFile,
    requestKey,
    responseHeaders: publiclyAccessible
      ? PUBLIC_DEMO_RESOURCE_HEADERS
      : EXECUTIVE_PREVIEW_PRIVATE_HEADERS,
    root,
  });
}

export function isExecutivePreviewRuntimePublic(
  requestKey: string,
  publicDemoIds: readonly DemoId[] = getDemoLifecycleCatalog().publicIds,
): boolean {
  const owner = EXECUTIVE_PREVIEW_RUNTIME_OWNERS[requestKey];
  return Boolean(owner && publicDemoIds.some((id) => id === owner));
}

export async function serveExecutivePreviewRuntime({
  authorized,
  headOnly,
  publicDemoIds = getDemoLifecycleCatalog().publicIds,
  readFile,
  requestKey,
  root,
}: ServeExecutivePreviewRuntimeOptions): Promise<Response> {
  const publiclyAccessible = isExecutivePreviewRuntimePublic(
    requestKey,
    publicDemoIds,
  );
  return serveAllowlistedResource({
    accessGranted: authorized || publiclyAccessible,
    contentType: 'application/javascript; charset=utf-8',
    files: EXECUTIVE_PREVIEW_RUNTIME_FILES,
    headOnly,
    readFile,
    requestKey,
    responseHeaders: publiclyAccessible
      ? PUBLIC_DEMO_RESOURCE_HEADERS
      : EXECUTIVE_PREVIEW_PRIVATE_HEADERS,
    root,
  });
}
