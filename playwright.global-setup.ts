import {rm} from 'node:fs/promises';
import {basename, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';

import {request, type FullConfig} from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const secret = process.env.PLAYWRIGHT_VERCEL_BYPASS_SECRET?.trim();
  if (!secret) return;

  const {baseURL, storageState} = config.projects[0]?.use ?? {};
  if (!baseURL || typeof storageState !== 'string') {
    throw new Error('Protected Preview setup requires a base URL and temporary storage state path.');
  }

  const authDirectory = dirname(storageState);
  if (
    dirname(resolve(authDirectory)) !== resolve(tmpdir()) ||
    !basename(authDirectory).startsWith('helpmath-vercel-auth-')
  ) {
    throw new Error('Protected Preview storage state must use its private temporary directory.');
  }

  const context = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': secret,
      'x-vercel-set-bypass-cookie': 'true',
    },
  });

  try {
    const response = await context.get('/', {maxRedirects: 0});
    if (!response.ok()) {
      throw new Error(`Protected Preview authentication returned HTTP ${response.status()}.`);
    }
    await context.storageState({path: storageState});
  } catch (error) {
    await rm(authDirectory, {force: true, recursive: true});
    throw error;
  } finally {
    await context.dispose();
  }

  return async () => {
    await rm(authDirectory, {force: true, recursive: true});
  };
}
