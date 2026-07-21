import path from 'node:path';

import {reviewDemoIds} from '@/demos/catalog';
import {demoCandidates} from '@/demos/candidates';

export const EXECUTIVE_PREVIEW_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export const EXECUTIVE_PREVIEW_RUNTIME_FILES: Readonly<Record<string, string>> =
  Object.freeze(Object.fromEntries(
    reviewDemoIds.map((id) => [`${id}.js`, `${id}.js`]),
  ));

const PRIVATE_ASSET_PREFIX = 'private-demo-assets/';

export const EXECUTIVE_PREVIEW_ASSET_FILES: Readonly<Record<string, string>> =
  Object.freeze(Object.fromEntries(
    reviewDemoIds.flatMap((id) => {
      const ownedAssetPrefix = `${PRIVATE_ASSET_PREFIX}${id}/`;
      return demoCandidates[id].artifacts
        .map(({path: artifactPath}) => artifactPath)
        .filter((artifactPath) => artifactPath.startsWith(ownedAssetPrefix))
        .map((artifactPath) => {
          const privatePath = artifactPath.slice(PRIVATE_ASSET_PREFIX.length);
          return [privatePath, privatePath] as const;
        });
    }),
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

function closedResponse(status = 404) {
  return new Response(null, {status, headers: EXECUTIVE_PREVIEW_PRIVATE_HEADERS});
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
  if (!authorized || !Object.hasOwn(files, requestKey)) return closedResponse();

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
        ...EXECUTIVE_PREVIEW_PRIVATE_HEADERS,
        'Content-Length': String(bytes.byteLength),
        'Content-Type': contentType,
      },
    });
  } catch {
    return closedResponse(503);
  }
}
