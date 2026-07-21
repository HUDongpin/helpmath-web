import path from 'node:path';

export const EXECUTIVE_PREVIEW_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export const EXECUTIVE_PREVIEW_RUNTIME_FILES = {
  'conversion-1-2.js': 'conversion-1-2.js',
  'conversion-1-4.js': 'conversion-1-4.js',
} as const;

export const EXECUTIVE_PREVIEW_ASSET_FILES = {
  'conversion-1-2/gallon-0.png': 'conversion-1-2/gallon-0.png',
  'conversion-1-2/gallon-32.png': 'conversion-1-2/gallon-32.png',
  'conversion-1-2/gallon-64.png': 'conversion-1-2/gallon-64.png',
  'conversion-1-2/gallon-96.png': 'conversion-1-2/gallon-96.png',
  'conversion-1-2/gallon-128.png': 'conversion-1-2/gallon-128.png',
  'conversion-1-2/quart-empty-stage.png': 'conversion-1-2/quart-empty-stage.png',
  'conversion-1-2/quart-full-stage.png': 'conversion-1-2/quart-full-stage.png',
  'conversion-1-2/quart-pouring-empty.png': 'conversion-1-2/quart-pouring-empty.png',
  'conversion-1-2/quart-pouring-full.png': 'conversion-1-2/quart-pouring-full.png',
  'conversion-1-4/cylinder-base.png': 'conversion-1-4/cylinder-base.png',
  'conversion-1-4/pitcher-back.png': 'conversion-1-4/pitcher-back.png',
  'conversion-1-4/pitcher-front.png': 'conversion-1-4/pitcher-front.png',
} as const;

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
