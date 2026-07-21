import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';

type RuntimeIssue = {kind: 'console' | 'page'; message: string};

const closedLegacyDemoAssets = [
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
const executivePreviewAssets = [
  '/api/executive-preview/assets/conversion-1-2/gallon-0.png',
  '/api/executive-preview/assets/conversion-1-2/gallon-32.png',
  '/api/executive-preview/assets/conversion-1-2/gallon-64.png',
  '/api/executive-preview/assets/conversion-1-2/gallon-96.png',
  '/api/executive-preview/assets/conversion-1-2/gallon-128.png',
  '/api/executive-preview/assets/conversion-1-2/quart-empty-stage.png',
  '/api/executive-preview/assets/conversion-1-2/quart-full-stage.png',
  '/api/executive-preview/assets/conversion-1-2/quart-pouring-empty.png',
  '/api/executive-preview/assets/conversion-1-2/quart-pouring-full.png',
  '/api/executive-preview/assets/conversion-1-4/cylinder-base.png',
  '/api/executive-preview/assets/conversion-1-4/pitcher-back.png',
  '/api/executive-preview/assets/conversion-1-4/pitcher-front.png',
] as const;
const executivePreviewRuntimes = [
  '/api/executive-preview/runtime/conversion-1-2.js',
  '/api/executive-preview/runtime/conversion-1-4.js',
] as const;
const executivePreviewAccessKey =
  process.env.PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY?.trim();

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
  const structuredData = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
  ) as {'@type'?: string; inLanguage?: string[]};
  expect(structuredData['@type']).toBe('WebSite');
  expect(structuredData.inLanguage).toEqual(['en', 'es']);
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

test('language switching preserves the current path, query, and hash', async ({page}) => {
  await expectDocument(page, '/contact?topic=research#main-content', 'en');
  const spanish = page.getByRole('link', {name: 'Language: Español'}).first();
  await expect(spanish).toHaveAttribute(
    'href',
    '/es/contact?topic=research#main-content',
  );
  await spanish.click();
  await expect(page).toHaveURL(/\/es\/contact\?topic=research#main-content$/);

  const english = page.getByRole('link', {name: 'Idioma: English'}).first();
  await expect(english).toHaveAttribute('href', '/contact?topic=research#main-content');
});

test('primary navigation marks the current section', async ({page}) => {
  await expectDocument(page, '/research', 'en');
  const navigation = page.getByRole('navigation', {name: 'Main navigation'});
  await expect(navigation.getByRole('link', {name: 'Research', exact: true})).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(navigation.getByRole('link', {name: 'About', exact: true})).not.toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('home metadata keeps the HELP Math name in both language titles', async ({page}) => {
  await expectDocument(page, '/', 'en');
  await expect(page).toHaveTitle('HELP Math · Math language made visible');

  await expectDocument(page, '/es', 'es');
  await expect(page).toHaveTitle('HELP Math · El lenguaje matemático, a la vista');
});

test('program lineage links HELP Math 1.0, Boulder Learning, and PedaNova with clear source boundaries', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/about', 'en');

  await expect(
    page.getByRole('heading', {level: 2, name: 'From HELP Math 1.0 to a proposed next generation'}),
  ).toBeVisible();
  for (const href of [
    'https://www.helpprogram.net/',
    'https://www.boulderlearning.com/products',
    'https://www.boulderlearning.com/about-us',
    'https://solve.mit.edu/solutions/88712',
    'https://www.pedanova.tech/',
    'https://www.pedanova.tech/team/',
  ]) {
    await expect(page.locator(`a[href="${href}"]`), href).toHaveCount(1);
  }
  await expect(page.getByText(/are strategic partners in the modernization of HELP Math 1\.0 into HELP Math 2\.0/i)).toBeVisible();
  await expect(page.getByText(/planned next phase in updating and relaunching/i)).toBeVisible();

  await expectDocument(page, '/es/about', 'es');
  await expect(
    page.getByRole('heading', {level: 2, name: 'De HELP Math 1.0 a una nueva generación propuesta'}),
  ).toBeVisible();
  await expect(page.locator('a[href="https://www.boulderlearning.com/products"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://www.pedanova.tech/"]')).toHaveCount(1);
  await expect(page.getByText(/son socios estratégicos en la modernización de HELP Math 1\.0 hacia HELP Math 2\.0/i)).toBeVisible();
  expectNoRuntimeIssues(issues);
});

test('research register cites WWC and preserves both positive and limiting historical evidence', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/research', 'en');

  await expect(page.getByRole('heading', {level: 2, name: /What Works Clearinghouse review/i})).toBeVisible();
  await expect(page.locator('a[href="https://ies.ed.gov/ncee/wwc/Study/72999"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://eric.ed.gov/?id=EJ1023032"]')).toHaveCount(1);
  await expect(page.getByText(/42\.1% score increase/i)).toBeVisible();
  await expect(page.getByText(/did not find an overall between-group main effect/i)).toBeVisible();
  await expect(page.getByText(/should not be restated as an award/i)).toBeVisible();

  await expectDocument(page, '/es/research', 'es');
  await expect(page.locator('a[href="https://ies.ed.gov/ncee/wwc/Study/72999"]')).toHaveCount(1);
  await expect(page.getByText(/no encontró un efecto principal general/i)).toBeVisible();
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
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toContainText('Close navigation');

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

  await expect(
    page.getByRole('heading', {level: 1, name: 'Check whether project requests are open'}),
  ).toBeVisible();
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

test('demo landing pages explain the private review boundary without linking prototypes', async ({page}) => {
  const issues = monitorRuntimeIssues(page);

  await expectDocument(page, '/demos', 'en');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Demos remain private while review is incomplete',
    }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/demos/conversion-"]')).toHaveCount(0);
  await expect(page.locator('[src*="/flash-assets/"]')).toHaveCount(0);

  await expectDocument(page, '/es/demos', 'es');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Las demostraciones siguen privadas mientras la revisión esté incompleta',
    }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/es/demos/conversion-"]')).toHaveCount(0);
  await expect(page.locator('[src*="/flash-assets/"]')).toHaveCount(0);
  expectNoRuntimeIssues(issues);
});

test('private demo routes and extracted assets fail closed', async ({request}) => {
  for (const [path, heading] of [
    ['/demos/conversion-1-2', 'Page not found'],
    ['/demos/conversion-1-4', 'Page not found'],
    ['/es/demos/conversion-1-2', 'Página no encontrada'],
    ['/es/demos/conversion-1-4', 'Página no encontrada'],
  ] as const) {
    const response = await request.get(path, {maxRedirects: 0});
    const html = await response.text();
    expect(response.status(), path).toBe(404);
    expect(response.headers()['x-robots-tag'], path).toContain('noindex');
    expect(response.headers()['x-robots-tag'], path).toContain('nofollow');
    expect(response.headers()['cache-control'], path).toContain('no-store');
    expect(response.headers()['content-type'], path).toContain('text/html');
    expect(html, path).toContain(heading);
  }

  for (const asset of [...closedLegacyDemoAssets, ...executivePreviewAssets]) {
    const response = await request.get(asset, {maxRedirects: 0});
    expect(response.status(), asset).toBe(404);
    expect(response.headers()['x-robots-tag'], asset).toContain('noindex');
    expect(response.headers()['x-robots-tag'], asset).toContain('nofollow');
    expect(response.headers()['cache-control'], asset).toContain('no-store');
    expect(response.headers()['content-type'] ?? '', asset).not.toContain('image/');
  }

  for (const runtime of executivePreviewRuntimes) {
    const response = await request.get(runtime, {maxRedirects: 0});
    expect(response.status(), runtime).toBe(404);
    expect(response.headers()['x-robots-tag'], runtime).toContain('noindex');
    expect(response.headers()['cache-control'], runtime).toContain('no-store');
    expect(response.headers()['content-type'] ?? '', runtime).not.toContain('javascript');
  }

  for (const optimizerPath of [
    '/_next/image?url=%2Fflash-assets%2Fcylinder-base.png&w=640&q=75',
    '/_vercel/image?url=%2Fflash-assets%2Fcylinder-base.png&w=640&q=75',
    '/_next/image?url=%2Fapi%2Fexecutive-preview%2Fassets%2Fconversion-1-4%2Fcylinder-base.png&w=640&q=75',
    '/_vercel/image?url=%2Fapi%2Fexecutive-preview%2Fassets%2Fconversion-1-4%2Fcylinder-base.png&w=640&q=75',
  ] as const) {
    const response = await request.get(optimizerPath, {maxRedirects: 0});
    expect(response.status(), optimizerPath).not.toBe(200);
    expect(response.headers()['content-type'] ?? '', optimizerPath).not.toContain('image/');
  }
});

test('executive preview grants a short-lived private session for both JavaScript demos', async ({
  page,
}) => {
  test.skip(!executivePreviewAccessKey, 'No executive preview access key was supplied.');
  const issues = monitorRuntimeIssues(page);
  await page.emulateMedia({reducedMotion: 'no-preference'});

  const entryResponse = await page.goto(
    '/executive-preview?returnTo=/demos/conversion-1-2',
    {waitUntil: 'networkidle'},
  );
  expect(entryResponse?.status()).toBe(200);
  expect(entryResponse?.headers()['x-robots-tag']).toContain('noindex');
  expect(entryResponse?.headers()['cache-control']).toContain('no-store');
  await expect(
    page.getByRole('heading', {level: 1, name: 'HELP Math JavaScript demo preview'}),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  await page.getByLabel('Executive preview passphrase').fill(executivePreviewAccessKey!);
  await Promise.all([
    page.waitForURL((url) =>
      url.pathname === '/demos/conversion-1-2' && url.search === ''
    ),
    page.getByRole('button', {name: 'Open private preview'}).click(),
  ]);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Internal review only', {exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {level: 1, name: 'Conversion 1.2'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Back to executive preview'})).toHaveAttribute(
    'href',
    '/executive-preview',
  );
  await expect(page.locator('.demo-player')).toHaveAttribute('data-playback-state', 'paused');
  const firstSlider = page.getByRole('slider', {name: 'Animation frame'});
  await expect(firstSlider).toHaveAttribute('max', '109');
  await page.getByRole('button', {name: 'Play animation'}).click();
  await expect(page.locator('.demo-player')).toHaveAttribute('data-playback-state', 'playing');
  await firstSlider.fill('109');
  await expect(page.locator('.flash-replay')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.flash-replay')).toHaveAttribute('tabindex', '-1');
  const restartButton = page.getByRole('button', {name: 'Restart from the beginning'});
  await restartButton.focus();
  const scrollBeforeRestart = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  await expect(restartButton).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeRestart);

  const authenticatedRequest = page.context().request;
  for (const asset of executivePreviewAssets) {
    const response = await authenticatedRequest.get(asset);
    expect(response.status(), asset).toBe(200);
    expect(response.headers()['content-type'], asset).toContain('image/png');
    expect(response.headers()['cache-control'], asset).toContain('no-store');
    expect(response.headers()['x-robots-tag'], asset).toContain('noindex');
  }
  for (const runtime of executivePreviewRuntimes) {
    const response = await authenticatedRequest.get(runtime);
    expect(response.status(), runtime).toBe(200);
    expect(response.headers()['content-type'], runtime).toContain('javascript');
    expect(response.headers()['cache-control'], runtime).toContain('no-store');
    expect(response.headers()['x-robots-tag'], runtime).toContain('noindex');
    expect((await response.body()).byteLength, runtime).toBeGreaterThan(0);
  }

  await page.getByRole('link', {name: 'Back to executive preview'}).click();
  await expect(page).toHaveURL(/\/executive-preview$/);
  await expect(page.getByRole('link', {name: 'Open prototype: Conversion 1.2'})).toBeVisible();
  const secondDemoLink = page.getByRole('link', {name: 'Open prototype: Conversion 1.4'});
  await expect(secondDemoLink).toHaveAttribute('href', '/demos/conversion-1-4');
  await secondDemoLink.click();
  await expect(page.getByRole('heading', {level: 1, name: 'Conversion 1.4'})).toBeVisible();
  await expect(page.getByRole('slider', {name: 'Animation frame'})).toHaveAttribute('max', '67');

  await page.goto('/executive-preview', {waitUntil: 'networkidle'});
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/executive-preview' && url.search === ''),
    page.getByRole('button', {name: 'End private session'}).click(),
  ]);
  await expect(page.getByLabel('Executive preview passphrase')).toBeVisible();

  await page.goto('/es/executive-preview?returnTo=/demos/conversion-1-4', {
    waitUntil: 'networkidle',
  });
  await page.getByLabel('Frase de acceso para la vista previa ejecutiva').fill(
    executivePreviewAccessKey!,
  );
  await Promise.all([
    page.waitForURL((url) =>
      url.pathname === '/es/demos/conversion-1-4' && url.search === ''
    ),
    page.getByRole('button', {name: 'Abrir vista previa privada'}).click(),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByText('Solo revisión interna', {exact: true})).toBeVisible();
  await expect(page.locator('output').filter({hasText: 'Fotograma 1 de 67'})).toBeAttached();
  await expect(page.locator('g[aria-label="1 liter = 1000 milliliters"]')).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844});
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  const authenticatedAccessibility = await new AxeBuilder({page})
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    authenticatedAccessibility.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([]);

  await page.goto('/es/executive-preview', {waitUntil: 'networkidle'});
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/es/executive-preview' && url.search === ''),
    page.getByRole('button', {name: 'Cerrar sesión privada'}).click(),
  ]);
  const deniedAfterLogout = await authenticatedRequest.get('/demos/conversion-1-2', {
    maxRedirects: 0,
  });
  expect(deniedAfterLogout.status()).toBe(404);
  expect((await authenticatedRequest.get(executivePreviewRuntimes[0])).status()).toBe(404);
  expect((await authenticatedRequest.get(executivePreviewAssets[0])).status()).toBe(404);
  expectNoRuntimeIssues(issues);
});

test('executive preview reports an invalid passphrase at the input', async ({page}) => {
  test.skip(!executivePreviewAccessKey, 'No executive preview access key was supplied.');

  await page.goto('/executive-preview?returnTo=/demos/conversion-1-2', {
    waitUntil: 'networkidle',
  });
  const passphrase = page.getByLabel('Executive preview passphrase');
  await passphrase.fill('incorrect-executive-preview-key');
  await Promise.all([
    page.waitForURL((url) =>
      url.pathname === '/executive-preview' && url.searchParams.get('error') === '1'
    ),
    page.getByRole('button', {name: 'Open private preview'}).click(),
  ]);

  await expect(page.locator('#executive-preview-login-error')).toContainText(
    'Access could not be verified',
  );
  await expect(passphrase).toBeFocused();
  await expect(passphrase).toHaveAttribute('aria-invalid', 'true');
  await expect(passphrase).toHaveAttribute(
    'aria-describedby',
    'executive-preview-login-help executive-preview-login-error',
  );
});

test('unknown routes return a non-indexable branded 404 response', async ({page}) => {
  for (const path of [
    '/route-that-does-not-exist',
    '/apiary',
    '/_nextish',
    '/_vercelish',
  ] as const) {
    const response = await page.goto(path, {waitUntil: 'networkidle'});

    expect(response?.status(), path).toBe(404);
    expect(response?.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
    expect(response?.headers()['content-type'], path).toContain('text/html');
    await expect(page.getByRole('heading', {level: 1, name: 'Page not found'})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Return home'})).toHaveAttribute('href', '/');
    const languageLinks = page.locator('a.language-switcher');
    await expect(languageLinks).toHaveCount(2);
    await expect(languageLinks.nth(0)).toHaveAttribute('href', '/es');
    await expect(languageLinks.nth(1)).toHaveAttribute('href', '/es');
    await expect(page.locator('a[href*="site-not-found-internal"]')).toHaveCount(0);
    await expect(page).toHaveTitle('Page not found · HELP Math');
  }
});

test('Spanish unknown routes keep localized navigation and a non-indexable 404', async ({page}) => {
  const response = await page.goto('/es/ruta/que-no-existe', {waitUntil: 'networkidle'});

  expect(response?.status()).toBe(404);
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', {level: 1, name: 'Página no encontrada'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Volver al inicio'})).toHaveAttribute('href', '/es');
  const languageLinks = page.locator('a.language-switcher');
  await expect(languageLinks).toHaveCount(2);
  await expect(languageLinks.nth(0)).toHaveAttribute('href', '/');
  await expect(languageLinks.nth(1)).toHaveAttribute('href', '/');
  await expect(page.locator('a[href*="site-not-found-internal"]')).toHaveCount(0);
  await expect(page).toHaveTitle('Página no encontrada · HELP Math');
});

test('unknown files return one branded non-indexable 404 policy', async ({page}) => {
  const response = await page.goto('/missing-historical-document.pdf', {waitUntil: 'networkidle'});

  expect(response?.status()).toBe(404);
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response?.headers()['content-type']).toContain('text/html');
  const robotsMeta = page.locator('meta[name="robots"]');
  expect(await robotsMeta.count()).toBeGreaterThanOrEqual(1);
  for (let index = 0; index < await robotsMeta.count(); index += 1) {
    await expect(robotsMeta.nth(index)).toHaveAttribute('content', /noindex/);
  }
  await expect(page.getByRole('heading', {level: 1, name: 'Page not found'})).toBeVisible();
});

test('audited legacy pages and document directories redirect permanently', async ({request}) => {
  for (const [legacyPath, destination] of [
    ['/Contact.htm', '/contact'],
    ['/Ped.htm', '/approach'],
    ['/Kf.htm', '/about'],
    ['/Mph.htm', '/about'],
    ['/Sheltered.htm', '/approach'],
    ['/Sheltered%20Instruction.wmv', '/approach'],
    ['/Demo.htm', '/demos'],
    ['/HELP%20Math%20Privacy%20Policy%203.12.07.pdf', '/privacy'],
    ['/HELP%20Math%20Privacy%20Policy%203.12.07.doc', '/privacy'],
    ['/HELP%20evaluation%20white%20paper%20June%202005.pdf', '/research'],
    ['/HELP%20Math%20Correlations%20CCS%206%207%208.pdf', '/curriculum'],
    ['/student_login.aspx', '/login'],
    ['/Project_Admin_Login.aspx', '/login'],
    ['/trial_register.aspx', '/contact'],
    ['/PR.htm', '/research'],
    ['/DDI%206-22-09NEWS%20RELEASE%20(final).pdf', '/research'],
    ['/PR/historical-study.pdf', '/research'],
    ['/DealerDocs/historical-guide.pdf', '/resources'],
    ['/teacher_guide/historical-guide.pdf', '/resources'],
    ['/shortdemo/index.htm', '/demos'],
  ] as const) {
    const response = await request.get(legacyPath, {maxRedirects: 0});
    expect(response.status(), legacyPath).toBe(308);
    expect(response.headers().location, legacyPath).toBe(destination);
  }

  for (const intentionallyUnavailable of [
    '/Images/Help_Slideshow.swf',
    '/0214%20Sunburst%20and%20BLI%20Form%20partnership%20for%20HELP%20Math2.pdf',
  ] as const) {
    const response = await request.get(intentionallyUnavailable, {maxRedirects: 0});
    expect(response.status(), intentionallyUnavailable).toBe(404);
    expect(response.headers()['x-robots-tag'], intentionallyUnavailable).toBe(
      'noindex, nofollow',
    );
  }

  const queryResponse = await request.get('/Contact.htm?source=cutover&campaign=legacy', {
    maxRedirects: 0,
  });
  expect(queryResponse.status()).toBe(308);
  expect(queryResponse.headers().location).toBe('/contact?source=cutover&campaign=legacy');

  for (const [englishPrefix, canonical] of [
    ['/en', '/'],
    ['/en/about?source=explicit-prefix', '/about?source=explicit-prefix'],
    ['/en/demos/conversion-1-2', '/demos/conversion-1-2'],
  ] as const) {
    const response = await request.get(englishPrefix, {maxRedirects: 0});
    expect(response.status(), englishPrefix).toBe(308);
    expect(response.headers().location, englishPrefix).toBe(canonical);
  }

  const spoofedInternalHeader = await request.get('/en/about', {
    headers: {'x-helpmath-internal-locale': 'en'},
    maxRedirects: 0,
  });
  expect(spoofedInternalHeader.status()).toBe(308);
  expect(spoofedInternalHeader.headers().location).toBe('/about');
});

test('every sitemap page has one heading, canonical metadata, and the expected language', async ({request}) => {
  const sitemap = await request.get('/sitemap.xml');
  const sitemapText = await sitemap.text();
  const urls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(urls).toHaveLength(20);

  for (const absoluteUrl of urls) {
    const parsed = new URL(absoluteUrl);
    const response = await request.get(`${parsed.pathname}${parsed.search}`);
    const html = await response.text();
    const expectedLanguage = parsed.pathname === '/es' || parsed.pathname.startsWith('/es/') ? 'es' : 'en';
    expect(response.status(), absoluteUrl).toBe(200);
    expect((html.match(/<h1\b/gi) ?? []).length, absoluteUrl).toBe(1);
    expect(html, absoluteUrl).toMatch(new RegExp(`<html[^>]+lang=["']${expectedLanguage}["']`, 'i'));
    expect(html, absoluteUrl).toContain(`rel="canonical" href="${absoluteUrl.replace(/\/$/, '') || absoluteUrl}"`);
  }
});

test('representative content and status pages do not overflow a phone viewport', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  for (const path of [
    '/',
    '/es',
    '/research',
    '/es/research',
    '/resources',
    '/es/resources',
    '/demos',
    '/es/demos',
    '/executive-preview',
    '/es/executive-preview',
  ] as const) {
    await expectDocument(page, path, path.startsWith('/es') ? 'es' : 'en');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
  }
});

test('robots and sitemap publish crawl policy and both locale variants', async ({request}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  const robotsText = await robots.text();
  expect(robotsText).toContain('User-Agent: *');
  expect(robotsText).toContain('Disallow: /api/');
  expect(robotsText).toContain('Disallow: /executive-preview');
  expect(robotsText).toContain('Disallow: /demos/conversion-1-2');
  expect(robotsText).toContain('Disallow: /flash-assets/');
  expect(robotsText).toContain('Sitemap: https://www.helpmath.ai/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('application/xml');
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('<loc>https://www.helpmath.ai/</loc>');
  expect(sitemapText).toContain('<loc>https://www.helpmath.ai/es</loc>');
  expect(sitemapText).toContain('hreflang="x-default"');
  expect(sitemapText).not.toContain('https://www.helpmath.ai/demos/conversion-1-2');
  expect(sitemapText).not.toContain('https://www.helpmath.ai/es/demos/conversion-1-4');
  expect(sitemapText).not.toContain('executive-preview');
  expect(sitemapText).not.toContain('https://www.helpmath.ai/privacy');
  expect(sitemapText).not.toContain('https://www.helpmath.ai/terms');
  expect(sitemapText).not.toContain('https://www.helpmath.ai/es/privacy');
  expect(sitemapText).not.toContain('https://www.helpmath.ai/es/terms');
});

for (const path of ['/privacy', '/terms', '/es/privacy', '/es/terms'] as const) {
  test(`${path} exposes the draft but prevents search indexing`, async ({page}) => {
    const response = await page.goto(path, {waitUntil: 'networkidle'});
    expect(response?.status()).toBe(200);
    expect(response?.headers()['x-robots-tag']).toBe('noindex, follow');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, follow',
    );
    await expect(page.locator('.legal-meta p')).toContainText(
      path.startsWith('/es') ? 'Borrador' : 'Draft',
    );
  });
}

for (const path of [
  '/',
  '/es',
  '/login',
  '/contact',
  '/demos',
  '/executive-preview',
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
