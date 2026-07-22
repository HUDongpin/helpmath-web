import {expect, test, type Page} from '@playwright/test';

async function preparePage(
  page: Page,
  path: string,
  viewport: {width: number; height: number},
) {
  await page.setViewportSize(viewport);
  const response = await page.goto(path, {waitUntil: 'networkidle'});
  expect(response?.status()).toBe(200);

  const fonts = await page.evaluate(async () => {
    const loaded = await Promise.all([
      document.fonts.load('400 16px "Nunito Sans Variable"'),
      document.fonts.load('700 32px "Fredoka Variable"'),
    ]);
    await document.fonts.ready;
    window.scrollTo(0, 0);
    return loaded.map((faces) => faces.length);
  });
  expect(fonts.every((count) => count > 0)).toBe(true);
}

const screenshotOptions = {
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
} as const;

test('English home desktop viewport', async ({page}) => {
  await preparePage(page, '/', {width: 1280, height: 800});
  await expect(page).toHaveScreenshot('home-desktop.png', screenshotOptions);
});

test('English home mobile viewport', async ({page}) => {
  await preparePage(page, '/', {width: 390, height: 844});
  await expect(page).toHaveScreenshot('home-mobile.png', screenshotOptions);
});

test('English research hero', async ({page}) => {
  await preparePage(page, '/research', {width: 1280, height: 800});
  await expect(page).toHaveScreenshot(
    'research-hero-desktop.png',
    screenshotOptions,
  );
});

test('Spanish Terms hero at the minimum supported width', async ({page}) => {
  await preparePage(page, '/es/terms', {width: 320, height: 740});
  await expect(page).toHaveScreenshot(
    'spanish-terms-hero-320.png',
    screenshotOptions,
  );
});
