import {defineConfig, devices} from '@playwright/test';

const port = 3212;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './visual-tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  outputDir: 'artifacts/playwright-visual',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      threshold: 0.2,
    },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    colorScheme: 'light',
    contextOptions: {
      reducedMotion: 'reduce',
    },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
