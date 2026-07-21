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
  isExecutivePreviewAssetPublic,
  serveExecutivePreviewAsset,
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

async function serveAsset(
  request: NextRequest,
  params: Promise<{asset: string[]}>,
  headOnly: boolean,
) {
  const {asset} = await params;
  const relativePath = asset.join('/');
  const publiclyAccessible = isExecutivePreviewAssetPublic(relativePath);
  return serveExecutivePreviewAsset({
    authorized: publiclyAccessible ? false : await isAuthorized(request),
    headOnly,
    readFile,
    requestKey: relativePath,
    root: path.join(process.cwd(), 'private-demo-assets'),
  });
}

export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{asset: string[]}>},
) {
  return serveAsset(request, params, false);
}

export async function HEAD(
  request: NextRequest,
  {params}: {params: Promise<{asset: string[]}>},
) {
  return serveAsset(request, params, true);
}
