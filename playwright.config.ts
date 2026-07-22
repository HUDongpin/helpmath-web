import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {defineConfig, devices} from '@playwright/test';

const port = 3211;
const localBaseURL = `http://127.0.0.1:${port}`;
const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = configuredBaseURL
  ? new URL(configuredBaseURL).toString().replace(/\/$/, '')
  : localBaseURL;
const vercelBypassSecret = process.env.PLAYWRIGHT_VERCEL_BYPASS_SECRET?.trim();
const useVercelBypass = Boolean(configuredBaseURL && vercelBypassSecret);

if (useVercelBypass && new URL(baseURL).protocol !== 'https:') {
  throw new Error('PLAYWRIGHT_VERCEL_BYPASS_SECRET requires an HTTPS PLAYWRIGHT_BASE_URL.');
}
if (
  configuredBaseURL &&
  process.env.PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY?.trim() &&
  new URL(baseURL).protocol !== 'https:' &&
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)
) {
  throw new Error(
    'PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY requires HTTPS unless PLAYWRIGHT_BASE_URL is loopback.',
  );
}

if (!configuredBaseURL) {
  process.env.EXECUTIVE_PREVIEW_ENABLED ??= 'true';
  process.env.EXECUTIVE_PREVIEW_ACCESS_KEY ??= 'HM-Local-Executive-Preview-Key-2026-X9';
  process.env.EXECUTIVE_PREVIEW_SESSION_SECRET ??= 'HM-Local-Session-Secret-2026-V7qL4mN8R2xZ';
  process.env.EXECUTIVE_PREVIEW_EXPIRES_AT ??= '2099-01-01T00:00:00.000Z';
  process.env.PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY ??=
    process.env.EXECUTIVE_PREVIEW_ACCESS_KEY;
}

function temporaryVercelAuthStatePath() {
  const inheritedPath = process.env.HELP_MATH_PLAYWRIGHT_AUTH_STATE?.trim();
  if (inheritedPath) return inheritedPath;

  const directory = mkdtempSync(path.join(tmpdir(), 'helpmath-vercel-auth-'));
  const statePath = path.join(directory, 'state.json');
  process.env.HELP_MATH_PLAYWRIGHT_AUTH_STATE = statePath;
  return statePath;
}

const vercelAuthStatePath = useVercelBypass ? temporaryVercelAuthStatePath() : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['line']],
  outputDir: '/tmp/helpmath-site-playwright-results',
  globalSetup: useVercelBypass ? './playwright.global-setup.ts' : undefined,
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'webkit-smoke',
      grep: /@webkit-smoke/u,
      use: {...devices['Desktop Safari']},
    },
  ],
  use: {
    baseURL,
    contextOptions: {
      reducedMotion: 'reduce',
    },
    locale: 'en-US',
    screenshot: 'only-on-failure',
    storageState: vercelAuthStatePath,
    // Remote runs may carry either a Vercel bypass cookie or the executive
    // preview session cookie. Never retain a trace artifact containing either.
    trace: configuredBaseURL ? 'off' : 'retain-on-failure',
  },
  webServer: configuredBaseURL
    ? undefined
    : {
        command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: `${localBaseURL}/robots.txt`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
