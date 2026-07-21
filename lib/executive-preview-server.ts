import 'server-only';

import {cookies} from 'next/headers';

import {
  EXECUTIVE_PREVIEW_COOKIE_NAME,
  getExecutivePreviewConfig,
  verifyExecutivePreviewSession,
} from './executive-preview-access';

/**
 * Performs a server-component authorization check at the protected resource.
 * Proxy checks remain useful for early rejection, but are not the sole gate.
 */
export async function hasExecutivePreviewSession(): Promise<boolean> {
  const config = getExecutivePreviewConfig();
  if (!config) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(EXECUTIVE_PREVIEW_COOKIE_NAME)?.value;
  return verifyExecutivePreviewSession(token, config);
}
