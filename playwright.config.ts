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
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    contextOptions: {
      reducedMotion: 'reduce',
    },
    locale: 'en-US',
    screenshot: 'only-on-failure',
    storageState: vercelAuthStatePath,
    trace: useVercelBypass ? 'off' : 'retain-on-failure',
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
