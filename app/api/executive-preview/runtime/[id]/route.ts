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
  isExecutivePreviewRuntimePublic,
  serveExecutivePreviewRuntime,
} from '@/lib/executive-preview-resources';
import {getDemoLifecycleCatalog} from '@/lib/demo-lifecycle';

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
  const publicDemoIds = getDemoLifecycleCatalog().publicIds;
  const publiclyAccessible = isExecutivePreviewRuntimePublic(
    id,
    publicDemoIds,
  );
  return serveExecutivePreviewRuntime({
    authorized: publiclyAccessible ? false : await isAuthorized(request),
    headOnly,
    publicDemoIds,
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
