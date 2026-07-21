import 'server-only';

import {readFile} from 'node:fs/promises';
import path from 'node:path';

import {NextRequest} from 'next/server';

import {
  EXECUTIVE_PREVIEW_COOKIE_NAME,
  getExecutivePreviewConfig,
  verifyExecutivePreviewSession,
} from '@/lib/executive-preview-access';
import {
  EXECUTIVE_PREVIEW_RUNTIME_FILES,
  serveExecutivePreviewResource,
} from '@/lib/executive-preview-resources';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const config = getExecutivePreviewConfig();
  if (!config) return false;
  return verifyExecutivePreviewSession(
    request.cookies.get(EXECUTIVE_PREVIEW_COOKIE_NAME)?.value,
    config,
  );
}

async function serveRuntime(
  request: NextRequest,
  params: Promise<{id: string}>,
  headOnly: boolean,
) {
  const {id} = await params;
  return serveExecutivePreviewResource({
    authorized: await isAuthorized(request),
    contentType: 'application/javascript; charset=utf-8',
    files: EXECUTIVE_PREVIEW_RUNTIME_FILES,
    headOnly,
    readFile,
    requestKey: id,
    root: path.join(
      process.cwd(),
      '.next-private',
      'executive-demo-runtime',
    ),
  });
}

export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  return serveRuntime(request, params, false);
}

export async function HEAD(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  return serveRuntime(request, params, true);
}
