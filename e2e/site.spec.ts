import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';

type RuntimeIssue = {kind: 'console' | 'page'; message: string};

const demoAssets = [
  '/flash-assets/conversion-1-2/gallon-0.png',
  '/flash-assets/conversion-1-2/gallon-32.png',
  '/flash-assets/conversion-1-2/gallon-64.png',
  '/flash-assets/conversion-1-2/gallon-96.png',
  '/flash-assets/conversion-1-2/gallon-128.png',
  '/flash-assets/conversion-1-2/quart-empty-stage.png',
  '/flash-assets/conversion-1-2/quart-full-stage.png',
  '/flash-assets/conversion-1-2/quart-pouring-empty.png',
  '/flash-assets/conversion-1-2/quart-pouring-full.png',
  '/flash-assets/cylinder-base.png',
  '/flash-assets/pitcher-back.png',
  '/flash-assets/pitcher-front.png',
] as const;

function monitorRuntimeIssues(page: Page): RuntimeIssue[] {
  const issues: RuntimeIssue[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push({kind: 'console', message: message.text()});
    }
  });
  page.on('pageerror', (error) => {
    issues.push({kind: 'page', message: error.message});
  });

  return issues;
}

function expectNoRuntimeIssues(issues: RuntimeIssue[]) {
  expect(issues, `Unexpected browser errors:\n${JSON.stringify(issues, null, 2)}`).toEqual([]);
}

async function expectDocument(page: Page, path: string, language: 'en' | 'es') {
  const response = await page.goto(path, {waitUntil: 'networkidle'});
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('main#main-content')).toBeVisible();
}

test('English home exposes the primary navigation and the language-rich project promise', async ({
  page,
}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/', 'en');

  await expect(
    page.getByRole('heading', {level: 1, name: 'See the language inside every math idea.'}),
  ).toBeVisible();

  const navigation = page.getByRole('navigation', {name: 'Main navigation'});
  const links = [
    ['About', '/about'],
    ['Approach', '/approach'],
    ['Curriculum', '/curriculum'],
    ['Research', '/research'],
    ['Resources', '/resources'],
    ['Demos', '/demos'],
  ] as const;
  for (const [name, href] of links) {
    await expect(navigation.getByRole('link', {name, exact: true})).toHaveAttribute('href', href);
  }

  await expect(page.getByRole('link', {name: 'Language: Español'}).first()).toHaveAttribute(
    'href',
    '/es',
  );
  expectNoRuntimeIssues(issues);
});

test('Spanish home localizes content and never duplicates the /es route prefix', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/es', 'es');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Descubre el lenguaje dentro de cada idea matemática.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', {name: 'Navegación principal'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Idioma: English'}).first()).toHaveAttribute(
    'href',
    '/',
  );

  const localHrefs = await page.locator('a[href^="/"]').evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute('href')).filter(Boolean),
  );
  expect(localHrefs.some((href) => href?.includes('/es/es'))).toBe(false);
  for (const href of localHrefs) {
    expect(href === '/' || href?.startsWith('/es')).toBe(true);
  }
  expectNoRuntimeIssues(issues);
});

test('mobile navigation opens at a phone viewport and reaches a primary route', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await page.setViewportSize({width: 390, height: 844});
  await expectDocument(page, '/', 'en');

  await expect(page.locator('.desktop-nav')).toBeHidden();
  const menu = page.locator('details.mobile-nav');
  const trigger = menu.locator(':scope > summary');
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText('Open navigation');
  await trigger.click();
  await expect(menu).toHaveAttribute('open', '');

  const approach = menu.getByRole('link', {name: 'Approach', exact: true});
  await expect(approach).toBeVisible();
  await expect(approach).toHaveAttribute('href', '/approach');
  await approach.click();
  await expect(page).toHaveURL(/\/approach$/);
  await expect(page.getByRole('heading', {level: 1})).toContainText('Make the mathematics');
  expectNoRuntimeIssues(issues);
});

test('account access page is a status page and never renders credential fields', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/login', 'en');

  await expect(
    page.getByRole('heading', {level: 1, name: 'The former HELP Math login is not active here'}),
  ).toBeVisible();
  await expect(page.getByText('Protect your old credentials', {exact: true})).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="username"]')).toHaveCount(0);
  expectNoRuntimeIssues(issues);
});

test('contact page fails closed until verified delivery is configured', async ({
  page,
}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/contact', 'en');

  await expect(page.getByRole('heading', {level: 1, name: 'Tell us what you are looking for'})).toBeVisible();
  await expect(
    page.getByRole('heading', {level: 2, name: 'Contact intake is not accepting messages yet'}),
  ).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
  await expect(
    page.getByRole('heading', {level: 2, name: 'Do not send student or account secrets'}),
  ).toBeVisible();
  await expect(page.getByText(/student data, passwords, or account information/i)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expectNoRuntimeIssues(issues);
});

for (const demo of [
  {id: 'conversion-1-2', title: 'Conversion 1.2'},
  {id: 'conversion-1-4', title: 'Conversion 1.4'},
] as const) {
  test(`${demo.title} detail renders its deterministic JavaScript stage`, async ({page}) => {
    const issues = monitorRuntimeIssues(page);
    await expectDocument(page, `/demos/${demo.id}?frame=1`, 'en');

    await expect(page.getByRole('heading', {level: 1, name: demo.title})).toBeVisible();
    await expect(page.locator('.demo-player .faithful-stage')).toBeVisible();
    await expect(page.locator('object, embed')).toHaveCount(0);
    await expect(page.locator('[src$=".swf"], [data$=".swf"]')).toHaveCount(0);
    expectNoRuntimeIssues(issues);
  });
}

test('all public demo image assets respond with PNG content', async ({request}) => {
  for (const asset of demoAssets) {
    const response = await request.get(asset);
    expect(response.status(), asset).toBe(200);
    expect(response.headers()['content-type'], asset).toContain('image/png');
    expect((await response.body()).byteLength, asset).toBeGreaterThan(100);
  }
});

test('unknown routes return a non-indexable 404 response', async ({page}) => {
  const response = await page.goto('/route-that-does-not-exist', {waitUntil: 'networkidle'});

  expect(response?.status()).toBe(404);
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.locator('body')).toHaveText('Not Found');
});

test('audited legacy pages and document directories redirect permanently', async ({request}) => {
  for (const [legacyPath, destination] of [
    ['/Contact.htm', '/contact'],
    ['/Ped.htm', '/approach'],
    ['/Demo.htm', '/demos'],
    ['/PR/historical-study.pdf', '/research'],
    ['/DealerDocs/historical-guide.pdf', '/resources'],
    ['/shortdemo/index.htm', '/demos'],
  ] as const) {
    const response = await request.get(legacyPath, {maxRedirects: 0});
    expect(response.status(), legacyPath).toBe(308);
    expect(response.headers().location, legacyPath).toBe(destination);
  }
});

test('robots and sitemap publish crawl policy and both locale variants', async ({request}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  const robotsText = await robots.text();
  expect(robotsText).toContain('User-Agent: *');
  expect(robotsText).toContain('Disallow: /api/');
  expect(robotsText).toContain('Sitemap: https://www.helpmath.ai/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('application/xml');
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('<loc>https://www.helpmath.ai/</loc>');
  expect(sitemapText).toContain('<loc>https://www.helpmath.ai/es</loc>');
  expect(sitemapText).toContain('https://www.helpmath.ai/demos/conversion-1-2');
  expect(sitemapText).toContain('https://www.helpmath.ai/es/demos/conversion-1-4');
});

for (const path of [
  '/',
  '/es',
  '/login',
  '/contact',
  '/demos',
  '/demos/conversion-1-2?frame=1',
  '/demos/conversion-1-4?frame=1',
] as const) {
  test(`${path} has no serious or critical axe violations`, async ({page}) => {
    const issues = monitorRuntimeIssues(page);
    const response = await page.goto(path, {waitUntil: 'networkidle'});
    expect(response?.status()).toBe(200);

    const results = await new AxeBuilder({page})
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(
      blocking,
      blocking
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
              .map((node) => `  ${node.target.join(' ')}: ${node.failureSummary ?? ''}`)
              .join('\n')}`,
        )
        .join('\n\n'),
    ).toEqual([]);
    expectNoRuntimeIssues(issues);
  });
}
