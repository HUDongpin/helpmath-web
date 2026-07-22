import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';
import {tsImport} from 'tsx/esm/api';
import {isLaunchGateApproved} from '../lib/launch-gates';

type RuntimeIssue = {kind: 'console' | 'page'; message: string};

const [demoCatalog, demoCandidateCatalog, contentCatalog] = await Promise.all([
  tsImport('../demos/catalog.ts', import.meta.url),
  tsImport('../demos/candidates/index.ts', import.meta.url),
  tsImport('../content/index.ts', import.meta.url),
]) as [
  typeof import('../demos/catalog'),
  typeof import('../demos/candidates'),
  typeof import('../content'),
];
const {demoIds, indexableDemoIds, reviewDemoIds} = demoCatalog;
const {DEMO_CANDIDATE_IDS, demoCandidates} = demoCandidateCatalog;
const {siteContent} = contentCatalog;
type DemoCandidateId = (typeof DEMO_CANDIDATE_IDS)[number];

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
const publicDemoIdSet = new Set<string>(demoIds);
const indexableDemoIdSet = new Set<string>(indexableDemoIds);
const nonPublicDemoIds = DEMO_CANDIDATE_IDS.filter((id) => !publicDemoIdSet.has(id));

function ownedAssetPaths(ids: readonly DemoCandidateId[]) {
  return ids.flatMap((id) => {
    const prefix = `private-demo-assets/${id}/`;
    return demoCandidates[id].artifacts
      .map(({path}) => path)
      .filter((artifactPath) => artifactPath.startsWith(prefix))
      .map((artifactPath) =>
        `/api/executive-preview/assets/${artifactPath.slice('private-demo-assets/'.length)}`
      );
  });
}

const privateExecutivePreviewAssets = ownedAssetPaths(nonPublicDemoIds);
const publicExecutivePreviewAssets = ownedAssetPaths(demoIds);
const reviewExecutivePreviewAssets = ownedAssetPaths(reviewDemoIds);
const lifecycleOptimizerProbes = DEMO_CANDIDATE_IDS.flatMap((id) => {
  const asset = ownedAssetPaths([id])[0];
  if (!asset) return [];
  const encodedAsset = encodeURIComponent(asset);
  return [
    `/_next/image?url=${encodedAsset}&w=640&q=75`,
    `/_vercel/image?url=${encodedAsset}&w=640&q=75`,
  ];
});
const executivePreviewRuntimeProbes = DEMO_CANDIDATE_IDS.map(
  (id) => `/api/executive-preview/runtime/${id}.js`,
);
const executivePreviewRuntimes = reviewDemoIds.map(
  (id) => `/api/executive-preview/runtime/${id}.js`,
);
const firstReviewDemoId = reviewDemoIds[0];
const hasCanonicalExecutiveReviewSet =
  reviewDemoIds.length === 2 &&
  reviewDemoIds.includes('conversion-1-2') &&
  reviewDemoIds.includes('conversion-1-4');
const executivePreviewAccessKey =
  process.env.PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY?.trim();
const legalPublicationApproved = isLaunchGateApproved('legalPublication');
const legalPagePaths = ['/privacy', '/terms'] as const;

const sitemapBasePaths = [
  '/',
  '/about',
  '/approach',
  '/curriculum',
  '/research',
  '/resources',
  '/demos',
  '/support',
  '/login',
  '/contact',
  ...(legalPublicationApproved ? legalPagePaths : []),
] as const;

const sitemapPagePaths = sitemapBasePaths.flatMap((path) =>
  path === '/' ? ['/', '/es'] : [path, `/es${path}`],
).concat(indexableDemoIds.flatMap((id) => [`/demos/${id}`, `/es/demos/${id}`]));

const browserExperiencePaths = [
  ...sitemapPagePaths,
  ...(!legalPublicationApproved
    ? ['/privacy', '/es/privacy', '/terms', '/es/terms']
    : []),
  '/executive-preview',
  '/es/executive-preview',
  ...demoIds.flatMap((id) => [`/demos/${id}`, `/es/demos/${id}`]),
] as const;

const browserExperienceViewports = [
  {name: 'desktop', width: 1280, height: 800, runAxe: true},
  {name: 'tablet', width: 768, height: 1024, runAxe: false},
  {name: '320px', width: 320, height: 740, runAxe: true},
] as const;

const legacyDeepLinkCases = [
  {
    legacyPath: '/ProgramInfo.htm',
    destination: '/curriculum#help-math-1-catalog',
    targetSelector: '#help-math-1-catalog',
  },
  {
    legacyPath: '/CODiE%20Award%20for%20Best%20Instructional%20Solution.pdf',
    destination: '/resources#codie-past-winners',
    targetSelector: '#codie-past-winners',
  },
  {
    legacyPath:
      '/DealerDocs/HELP%20Math%20Evaluation%20White%20Paper%205-13.pdf',
    destination: '/research#help-math-pilot',
    targetSelector: '#help-math-pilot',
  },
  {
    legacyPath:
      '/DealerDocs/U%20S%20%20Department%20of%20Education%20Research%20Summary%205-2013.pdf',
    destination: '/research#wwc-tran-study',
    targetSelector: '#wwc-tran-study',
  },
  {
    legacyPath:
      '/DealerDocs/HELP%20Math%20self-efficacy%20in%20secondary%20students%20R.pdf',
    destination: '/resources#freeman-2012-doi',
    targetSelector: '#freeman-2012-doi',
  },
  {
    legacyPath: '/DealerDocs/What%20Works%20Clearinghouse_help_102312.pdf',
    destination: '/resources#wwc-single-study-review',
    targetSelector: '#wwc-single-study-review',
  },
  {
    legacyPath:
      '/DealerDocs/Sheltered%20Instruction%20and%20SPED%202012.pdf',
    destination: '/approach#support-layers',
    targetSelector: '#support-layers',
  },
  {
    legacyPath: '/DealerDocs/Ed%20Week%20Article.pdf',
    destination: '/resources#education-week-2013',
    targetSelector: '#education-week-2013',
  },
  {
    legacyPath: '/DealerDocs/TechnologyInnovations.pdf',
    destination: '/resources#technology-innovations-report',
    targetSelector: '#technology-innovations-report',
  },
  {
    legacyPath: '/DealerDocs/Sage%20Publications%20article.pdf',
    destination: '/resources#ell-curriculum-eric',
    targetSelector: '#ell-curriculum-eric',
  },
  {
    legacyPath: '/DealerDocs/HelpMath%20print%208.5%20x%2011%20each.pdf',
    destination: '/resources#about-help-math',
    targetSelector: '#about-help-math',
  },
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

async function expectNoAxeViolations(
  page: Page,
  path: string,
  viewport: string,
) {
  const results = await new AxeBuilder({page})
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22a',
      'wcag22aa',
    ])
    .analyze();

  expect(
    results.violations,
    [
      `${path} at ${viewport} has accessibility violations:`,
      ...results.violations.map(
        (violation) =>
          `${violation.id} (${violation.impact ?? 'unknown impact'}): ${violation.help}\n${violation.nodes
            .map((node) => `  ${node.target.join(' ')}: ${node.failureSummary ?? ''}`)
            .join('\n')}`,
      ),
    ].join('\n\n'),
  ).toEqual([]);
}

async function expectDocument(page: Page, path: string, language: 'en' | 'es') {
  const response = await page.goto(path, {waitUntil: 'networkidle'});
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('main#main-content')).toBeVisible();
}

test('English home exposes the primary navigation and the language-rich project promise', {
  tag: '@webkit-smoke',
}, async ({page}) => {
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
    (await page.locator('script[data-structured-data="website"]').textContent()) ?? '{}',
  ) as {'@id'?: string; '@type'?: string; description?: string; inLanguage?: string[]; url?: string};
  expect(structuredData['@type']).toBe('WebSite');
  expect(structuredData['@id']).toBe('https://www.helpmath.ai/#website');
  expect(structuredData.inLanguage).toEqual(['en', 'es']);
  expect(structuredData.url).toBe('https://www.helpmath.ai/');
  expect(structuredData.description).toContain('HELP Math 1.0 history and research');

  const partnership = page.locator('#strategic-partnership');
  await expect(
    partnership.getByRole('heading', {
      level: 2,
      name: /Boulder Learning and PedaNova are strategic partners/i,
    }),
  ).toBeVisible();
  await expect(partnership.getByText(/Both organizations have confirmed this bilateral partnership/i)).toBeVisible();
  await expect(
    partnership.getByRole('link', {name: 'Explore Boulder Learning'}),
  ).toHaveAttribute('href', 'https://www.boulderlearning.com/products');
  await expect(partnership.getByRole('link', {name: 'Visit PedaNova'})).toHaveAttribute(
    'href',
    'https://www.pedanova.tech/',
  );
  expectNoRuntimeIssues(issues);
});

test('Spanish home localizes content and never duplicates the /es route prefix', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/es', 'es');
  await expect(page.locator('script[data-structured-data="website"]')).toHaveCount(0);

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
  const partnership = page.locator('#strategic-partnership');
  await expect(
    partnership.getByRole('heading', {
      level: 2,
      name: /Boulder Learning y PedaNova son socios estratégicos/i,
    }),
  ).toBeVisible();
  await expect(partnership.getByText(/Ambas organizaciones han confirmado esta alianza bilateral/i)).toBeVisible();
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

  const aboutData = JSON.parse(
    (await page.locator('script[data-structured-data="about-page"]').textContent()) ?? '{}',
  ) as {
    '@type'?: string;
    about?: Array<{name?: string}>;
    mentions?: Array<{name?: string}>;
    isPartOf?: {'@id'?: string};
    publisher?: unknown;
  };
  expect(aboutData['@type']).toBe('AboutPage');
  expect(aboutData.about?.map(({name}) => name)).toEqual([
    'HELP Math 1.0',
    'Proposed HELP Math 2.0 modernization',
  ]);
  expect(aboutData.mentions?.map(({name}) => name)).toEqual([
    'Boulder Learning',
    'PedaNova',
  ]);
  expect(aboutData.isPartOf?.['@id']).toBe('https://www.helpmath.ai/#website');
  expect(aboutData.publisher).toBeUndefined();

  await expect(
    page.getByRole('heading', {level: 2, name: 'From HELP Math 1.0 to a proposed next generation'}),
  ).toBeVisible();
  for (const href of [
    '/curriculum#help-math-1-catalog',
    '/resources#codie-past-winners',
    'https://www.boulderlearning.com/products',
    'https://www.boulderlearning.com/about-us',
    'https://solve.mit.edu/solutions/88712',
    'https://www.pedanova.tech/',
    'https://www.pedanova.tech/team/',
  ]) {
    await expect(page.locator(`a[href="${href}"]`), href).toHaveCount(1);
  }
  await expect(page.getByText(/are strategic partners in the modernization of HELP Math 1\.0 into HELP Math 2\.0/i)).toBeVisible();
  await expect(page.getByText(/have bilaterally confirmed this strategic partnership/i)).toBeVisible();
  await expect(page.getByText(/planned next phase in updating and relaunching/i)).toBeVisible();

  await expectDocument(page, '/es/about', 'es');
  await expect(
    page.getByRole('heading', {level: 2, name: 'De HELP Math 1.0 a una nueva generación propuesta'}),
  ).toBeVisible();
  await expect(page.locator('a[href="https://www.boulderlearning.com/products"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://www.pedanova.tech/"]')).toHaveCount(1);
  await expect(page.getByText(/son socios estratégicos en la modernización de HELP Math 1\.0 hacia HELP Math 2\.0/i)).toBeVisible();
  await expect(page.getByText(/han confirmado bilateralmente esta alianza estratégica/i)).toBeVisible();
  expectNoRuntimeIssues(issues);
});

test('historical curriculum publishes a dated HELP Math 1.0 catalog without making current-product promises', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/curriculum', 'en');

  const catalog = page.locator('#help-math-1-catalog');
  await expect(
    catalog.getByRole('heading', {
      level: 2,
      name: 'What dated 2007–2012 program records described',
    }),
  ).toBeVisible();
  await expect(catalog.getByRole('heading', {level: 3, name: /44 historical lessons/i})).toBeVisible();
  await expect(catalog.getByRole('heading', {level: 3, name: /29 historical lessons/i})).toBeVisible();
  await expect(catalog.getByText(/different counting conventions/i).first()).toBeVisible();
  await expect(catalog.getByText(/does not provide accounts, assignments, quizzes/i)).toBeVisible();
  await expect(catalog.getByRole('link', {name: 'Review the program lineage'})).toHaveAttribute(
    'href',
    '/about#program-lineage',
  );

  await expectDocument(page, '/es/curriculum', 'es');
  const spanishCatalog = page.locator('#help-math-1-catalog');
  await expect(spanishCatalog.getByRole('heading', {level: 3, name: /44 lecciones históricas/i})).toBeVisible();
  await expect(spanishCatalog.getByText(/convenciones de conteo distintas/i)).toBeVisible();
  expectNoRuntimeIssues(issues);
});

test('resource library filters eighteen sourced records in both languages', async ({page}) => {
  const issues = monitorRuntimeIssues(page);
  await expectDocument(page, '/resources', 'en');

  const library = page.locator('#resource-library');
  await expect(library.getByRole('status')).toHaveText('18 resources shown');
  await expect(library.locator('.resource-entry')).toHaveCount(18);
  await expect(library.getByRole('link', {name: 'Open the WWC study record'})).toHaveAttribute(
    'href',
    'https://ies.ed.gov/ncee/wwc/Study/72999',
  );
  await expect(library.getByRole('link', {name: 'Open the CODiE winners archive'})).toHaveAttribute(
    'href',
    'https://codieawards.com/past-winners',
  );
  await expect(library.getByRole('link', {name: 'Open the DOI record'})).toHaveAttribute(
    'href',
    'https://doi.org/10.1016/j.compedu.2011.11.003',
  );

  await library.getByRole('button', {name: /Research/}).click();
  await expect(library.getByRole('status')).toHaveText('12 resources shown');
  await expect(library.locator('.resource-entry')).toHaveCount(12);
  await expect(library.getByRole('heading', {name: 'About HELP Math'})).toHaveCount(0);

  await expectDocument(page, '/es/resources', 'es');
  const spanishLibrary = page.locator('#resource-library');
  await expect(spanishLibrary.getByRole('status')).toHaveText('Se muestran 18 recursos');
  await spanishLibrary.getByRole('button', {name: /Modernización/}).click();
  await expect(spanishLibrary.getByRole('status')).toHaveText('Se muestran 2 recursos');
  await expect(spanishLibrary.locator('.resource-entry')).toHaveCount(2);
  await expect(spanishLibrary.getByRole('heading', {name: 'Notas de modernización y recuperación'})).toBeVisible();
  expectNoRuntimeIssues(issues);
});

test('page hero motif localizes its visible math phrase', async ({page}) => {
  await expectDocument(page, '/contact', 'en');
  await expect(page.locator('.motif-card--words')).toHaveText('eight groups of four');

  await expectDocument(page, '/es/contact', 'es');
  await expect(page.locator('.motif-card--words')).toHaveText('ocho grupos de cuatro');
});

test('deep-link targets remain visible below the sticky site header', async ({page}) => {
  for (const [path, selector] of [
    ['/approach#support-layers', '#support-layers'],
    ['/about#program-lineage', '#program-lineage'],
    ['/about#preservation', '#preservation'],
    ['/curriculum#help-math-1-catalog', '#help-math-1-catalog'],
    ['/research#help-math-pilot', '#help-math-pilot'],
    ['/research#wwc-tran-study', '#wwc-tran-study'],
    ['/resources#codie-past-winners', '#codie-past-winners'],
    ['/resources#freeman-2012-doi', '#freeman-2012-doi'],
    ['/resources#wwc-single-study-review', '#wwc-single-study-review'],
    ['/resources#education-week-2013', '#education-week-2013'],
    ['/resources#technology-innovations-report', '#technology-innovations-report'],
    ['/resources#ell-curriculum-eric', '#ell-curriculum-eric'],
    ['/resources#about-help-math', '#about-help-math'],
  ] as const) {
    await page.goto(path, {waitUntil: 'networkidle'});
    const headerBottom = await page.locator('.site-header').evaluate(
      (header) => header.getBoundingClientRect().bottom,
    );
    const targetTop = await page.locator(selector).evaluate(
      (target) => target.getBoundingClientRect().top,
    );
    expect(targetTop, `${path} must clear the sticky header`).toBeGreaterThanOrEqual(
      headerBottom,
    );
  }
});

test('every exact legacy fragment redirect lands on its existing target', async ({page}) => {
  for (const {legacyPath, destination, targetSelector} of legacyDeepLinkCases) {
    const response = await page.goto(legacyPath, {waitUntil: 'networkidle'});
    expect(response?.status(), legacyPath).toBe(200);
    const finalUrl = new URL(page.url());
    expect(`${finalUrl.pathname}${finalUrl.hash}`, legacyPath).toBe(destination);
    await expect(page.locator(targetSelector), destination).toBeVisible();
  }
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

test('mobile navigation opens at a phone viewport and reaches a primary route', {
  tag: '@webkit-smoke',
}, async ({page}) => {
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
  await expect(page.getByText(/never asks for a former account password/i)).toBeVisible();
  await expect(page.getByText(/Only a named reviewer may enter a separate preview passphrase/i)).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="username"]')).toHaveCount(0);

  await expectDocument(page, '/es/login', 'es');
  await expect(page.getByText(/nunca pide la contraseña de una cuenta anterior/i)).toBeVisible();
  await expect(page.getByText(/Solo un revisor designado puede introducir una frase de acceso distinta/i)).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
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

test('demo landing pages expose only lifecycle-public demos and eligible reviewer entry', async ({page}) => {
  const issues = monitorRuntimeIssues(page);

  await expectDocument(page, '/demos', 'en');
  if (demoIds.length === 0) {
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Demos remain private while review is incomplete',
      }),
    ).toBeVisible();
  }
  const englishReviewerEntry = page.getByRole('link', {name: 'Authorized reviewer access'});
  if (reviewDemoIds.length > 0) {
    await expect(englishReviewerEntry).toHaveAttribute('href', '/executive-preview');
  } else {
    await expect(englishReviewerEntry).toHaveCount(0);
  }
  for (const id of demoIds) {
    await expect(page.locator(`a[href="/demos/${id}"]`)).toHaveCount(1);
  }
  for (const id of nonPublicDemoIds) {
    await expect(page.locator(`a[href="/demos/${id}"]`)).toHaveCount(0);
  }
  await expect(page.locator('[src*="/flash-assets/"]')).toHaveCount(0);

  await expectDocument(page, '/es/demos', 'es');
  if (demoIds.length === 0) {
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Las demostraciones siguen privadas mientras la revisión esté incompleta',
      }),
    ).toBeVisible();
  }
  const spanishReviewerEntry = page.getByRole('link', {name: 'Acceso de revisores autorizados'});
  if (reviewDemoIds.length > 0) {
    await expect(spanishReviewerEntry).toHaveAttribute('href', '/es/executive-preview');
  } else {
    await expect(spanishReviewerEntry).toHaveCount(0);
  }
  for (const id of demoIds) {
    await expect(page.locator(`a[href="/es/demos/${id}"]`)).toHaveCount(1);
  }
  for (const id of nonPublicDemoIds) {
    await expect(page.locator(`a[href="/es/demos/${id}"]`)).toHaveCount(0);
  }
  await expect(page.locator('[src*="/flash-assets/"]')).toHaveCount(0);
  expectNoRuntimeIssues(issues);
});

test('demo routes and owned assets follow the validated publication lifecycle', async ({request}) => {
  for (const id of nonPublicDemoIds) {
    for (const [path, heading] of [
      [`/demos/${id}`, 'Page not found'],
      [`/es/demos/${id}`, 'Página no encontrada'],
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
  }

  for (const id of demoIds) {
    const indexable = indexableDemoIdSet.has(id);
    for (const [path, locale] of [
      [`/demos/${id}`, 'en'],
      [`/es/demos/${id}`, 'es'],
    ] as const) {
      const response = await request.get(path, {maxRedirects: 0});
      const html = await response.text();
      expect(response.status(), path).toBe(200);
      expect(html, path).toContain(`lang="${locale}"`);
      expect(html, path).toContain(siteContent[locale].pages.demoDetails[id].title);
      if (indexable) {
        expect(response.headers()['x-robots-tag'] ?? '', path).not.toContain('noindex');
        expect(html, path).not.toMatch(/<meta[^>]+name="robots"[^>]+noindex/iu);
      } else {
        expect(response.headers()['x-robots-tag'], path).toContain('noindex');
        expect(html, path).toMatch(/<meta[^>]+name="robots"[^>]+noindex/iu);
      }
    }
  }

  for (const asset of [...closedLegacyDemoAssets, ...privateExecutivePreviewAssets]) {
    const response = await request.get(asset, {maxRedirects: 0});
    expect(response.status(), asset).toBe(404);
    expect(response.headers()['x-robots-tag'], asset).toContain('noindex');
    expect(response.headers()['x-robots-tag'], asset).toContain('nofollow');
    expect(response.headers()['cache-control'], asset).toContain('no-store');
    expect(response.headers()['content-type'] ?? '', asset).not.toContain('image/');
  }

  for (const asset of publicExecutivePreviewAssets) {
    const response = await request.get(asset, {maxRedirects: 0});
    expect(response.status(), asset).toBe(200);
    expect(response.headers()['content-type'], asset).toContain('image/png');
    expect(response.headers()['cache-control'], asset).toContain('public');
    expect(response.headers()['cache-control'], asset).toContain('max-age=0');
    expect(response.headers()['cache-control'], asset).toContain('must-revalidate');
    expect(response.headers()['cache-control'], asset).not.toContain('private');
    expect(response.headers().vary ?? '', asset).not.toMatch(/(?:^|,\s*)cookie(?:,|$)/iu);
    expect((await response.body()).byteLength, asset).toBeGreaterThan(0);
  }

  for (const runtime of executivePreviewRuntimeProbes) {
    const response = await request.get(runtime, {maxRedirects: 0});
    expect(response.status(), runtime).toBe(404);
    expect(response.headers()['x-robots-tag'], runtime).toContain('noindex');
    expect(response.headers()['cache-control'], runtime).toContain('no-store');
    expect(response.headers()['content-type'] ?? '', runtime).not.toContain('javascript');
  }

  // Direct lifecycle routes are the only supported demo-image delivery path;
  // the Next and Vercel image proxies remain disabled for public and private demos.
  for (const optimizerPath of [
    '/_next/image?url=%2Fflash-assets%2Fcylinder-base.png&w=640&q=75',
    '/_vercel/image?url=%2Fflash-assets%2Fcylinder-base.png&w=640&q=75',
    ...lifecycleOptimizerProbes,
  ]) {
    const response = await request.get(optimizerPath, {maxRedirects: 0});
    expect(response.status(), optimizerPath).not.toBe(200);
    expect(response.headers()['content-type'] ?? '', optimizerPath).not.toContain('image/');
  }
});

test('lifecycle-public demos load an interactive runtime and advance deterministically', async ({
  page,
}) => {
  test.skip(demoIds.length === 0, 'No lifecycle-public demo is currently active.');
  const issues = monitorRuntimeIssues(page);
  const failedAssetResponses: string[] = [];
  page.on('response', (response) => {
    const responseUrl = new URL(response.url());
    if (
      responseUrl.pathname.startsWith('/api/executive-preview/assets/') &&
      response.status() >= 400
    ) {
      failedAssetResponses.push(`${response.status()} ${responseUrl.pathname}`);
    }
  });

  for (const id of demoIds) {
    for (const locale of ['en', 'es'] as const) {
      const path = `${locale === 'es' ? '/es' : ''}/demos/${id}`;
      const detail = siteContent[locale].pages.demoDetails[id];
      await expectDocument(page, path, locale);
      await expect(page.locator('.demo-unavailable')).toHaveCount(0);
      await expect(page.locator('.demo-player')).toBeVisible();

      const slider = page.getByRole('slider', {name: detail.frameLabel});
      await expect(slider).toBeVisible();
      const terminalFrame = String(demoCandidates[id].movie.frameCount);
      await expect(slider).toHaveAttribute('max', terminalFrame);
      await slider.fill(terminalFrame);
      await expect(slider).toHaveValue(terminalFrame);
      await page.getByRole('button', {name: detail.restartLabel}).click();
      await expect(slider).toHaveValue('1');
    }
  }

  expect(failedAssetResponses).toEqual([]);
  expectNoRuntimeIssues(issues);
});

test('executive preview grants a short-lived private session for both JavaScript demos', {
  tag: '@webkit-smoke',
}, async ({page}) => {
  test.skip(!executivePreviewAccessKey, 'No executive preview access key was supplied.');
  test.skip(
    !hasCanonicalExecutiveReviewSet,
    'The detailed two-demo review flow applies only while both prototypes remain private-review.',
  );
  await page.clock.install();
  const clockPauseStepMs = 5 * 60 * 1000;
  let nextClockPauseAt = Date.now() + clockPauseStepMs;
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
  const reviewExpiry = page.locator('time[datetime]');
  await expect(reviewExpiry).toBeVisible();
  const reviewExpiryDateTime = await reviewExpiry.getAttribute('datetime');
  expect(reviewExpiryDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  expect(Date.parse(reviewExpiryDateTime!)).toBeGreaterThan(Date.now());
  await expect(page.getByText('Active sessions cannot continue beyond this time.')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', {name: 'Enter private preview'})).toHaveAttribute(
    'href',
    '#executive-preview-login',
  );

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
  await expect(firstSlider).toHaveValue('1');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '1');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 1 of 109');
  await page.getByRole('button', {name: 'Play animation'}).click();
  await expect(page.locator('.demo-player')).toHaveAttribute('data-playback-state', 'playing');
  await expect.poll(async () =>
    Number(await page.locator('.faithful-stage-wrap').getAttribute('data-flash-frame')),
  ).toBeGreaterThan(1);
  await firstSlider.fill('30');
  await expect(firstSlider).toHaveValue('30');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '30');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 30 of 109');
  await expect(page.locator('image[href$="quart-pouring-full.png"]')).toHaveCount(1);
  await expect(page.locator('image[href$="quart-pouring-empty.png"]')).toHaveCount(1);
  await firstSlider.fill('109');
  await expect(firstSlider).toHaveValue('109');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '109');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 109 of 109');
  await expect(page.locator('.flash-replay')).toHaveAttribute('opacity', '1');
  await expect(page.locator('.flash-replay')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.flash-replay')).toHaveAttribute('tabindex', '-1');
  const restartButton = page.getByRole('button', {name: 'Restart from the beginning'});
  await restartButton.focus();
  const scrollBeforeRestart = await page.evaluate(() => window.scrollY);
  await page.clock.pauseAt(nextClockPauseAt);
  await page.keyboard.press('Space');
  await expect(firstSlider).toHaveValue('1');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '1');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 1 of 109');
  await expect(restartButton).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeRestart);
  await page.clock.resume();

  const authenticatedRequest = page.context().request;
  for (const asset of reviewExecutivePreviewAssets) {
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
  await expect(page.locator('time[datetime]')).toHaveAttribute('datetime', reviewExpiryDateTime!);
  await expect(page.getByText('Active sessions cannot continue beyond this time.')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open prototype: Conversion 1.2'})).toBeVisible();
  const secondDemoLink = page.getByRole('link', {name: 'Open prototype: Conversion 1.4'});
  await expect(secondDemoLink).toHaveAttribute('href', '/demos/conversion-1-4');
  await secondDemoLink.click();
  await expect(page.getByRole('heading', {level: 1, name: 'Conversion 1.4'})).toBeVisible();
  const secondSlider = page.getByRole('slider', {name: 'Animation frame'});
  await expect(secondSlider).toHaveAttribute('max', '67');
  await expect(secondSlider).toHaveValue('1');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '1');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 1 of 67');
  await page.getByRole('button', {name: 'Play animation'}).click();
  await expect.poll(async () =>
    Number(await page.locator('.faithful-stage-wrap').getAttribute('data-flash-frame')),
  ).toBeGreaterThan(1);
  await secondSlider.fill('20');
  await expect(secondSlider).toHaveValue('20');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '20');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 20 of 67');
  await expect(page.locator('.faithful-stage > g[clip-path]')).toHaveCount(1);
  await secondSlider.fill('67');
  await expect(secondSlider).toHaveValue('67');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '67');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 67 of 67');
  await expect(page.locator('.flash-replay')).toHaveAttribute('opacity', '1');
  nextClockPauseAt += clockPauseStepMs;
  await page.clock.pauseAt(nextClockPauseAt);
  await page.getByRole('button', {name: 'Restart from the beginning'}).click();
  await expect(secondSlider).toHaveValue('1');
  await expect(page.locator('.faithful-stage-wrap')).toHaveAttribute('data-flash-frame', '1');
  await expect(page.locator('.demo-player__controls output')).toHaveText('Frame 1 of 67');
  await page.clock.resume();

  await page.goto('/executive-preview', {waitUntil: 'networkidle'});
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/executive-preview' && url.search === ''),
    page.getByRole('button', {name: 'End private session'}).click(),
  ]);
  await expect(page.getByLabel('Executive preview passphrase')).toBeVisible();

  await page.goto('/es/executive-preview?returnTo=/demos/conversion-1-4', {
    waitUntil: 'networkidle',
  });
  await expect(
    page.getByText('Las sesiones activas no pueden continuar después de esta hora.'),
  ).toBeVisible();
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
  await expectNoAxeViolations(
    page,
    '/es/demos/conversion-1-4 (authenticated)',
    '390px',
  );

  await page.goto('/es/demos/conversion-1-2', {waitUntil: 'networkidle'});
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', {level: 1, name: 'Conversión 1.2'})).toBeVisible();
  await expect(page.locator('output').filter({hasText: 'Fotograma 1 de 109'})).toBeAttached();
  await expect(page.getByText('Solo revisión interna', {exact: true})).toBeVisible();

  await page.goto('/es/executive-preview', {waitUntil: 'networkidle'});
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/es/executive-preview' && url.search === ''),
    page.getByRole('button', {name: 'Cerrar sesión privada'}).click(),
  ]);
  const deniedAfterLogout = await authenticatedRequest.get('/demos/conversion-1-2', {
    maxRedirects: 0,
  });
  expect(deniedAfterLogout.status()).toBe(404);
  expect((await authenticatedRequest.get(executivePreviewRuntimes[0]!)).status()).toBe(404);
  expect((await authenticatedRequest.get(reviewExecutivePreviewAssets[0]!)).status()).toBe(404);
  expectNoRuntimeIssues(issues);
});

test('executive preview reports an invalid passphrase at the input', async ({page}) => {
  test.skip(!executivePreviewAccessKey, 'No executive preview access key was supplied.');
  test.skip(!firstReviewDemoId, 'No lifecycle-private demo currently accepts reviewer return paths.');

  await page.goto(`/executive-preview?returnTo=/demos/${firstReviewDemoId}`, {
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
    ['/ProgramInfo.htm', '/curriculum#help-math-1-catalog'],
    ['/Sales.htm', '/resources'],
    ['/DealerDocs/HELP%20Math%20Evaluation%20White%20Paper%205-13.pdf', '/research#help-math-pilot'],
    ['/DealerDocs/U%20S%20%20Department%20of%20Education%20Research%20Summary%205-2013.pdf', '/research#wwc-tran-study'],
    ['/DealerDocs/HELP%20Math%20self-efficacy%20in%20secondary%20students%20R.pdf', '/resources#freeman-2012-doi'],
    ['/DealerDocs/What%20Works%20Clearinghouse_help_102312.pdf', '/resources#wwc-single-study-review'],
    ['/DealerDocs/SCOPE%20and%20Sequence%202012.pdf', '/curriculum#help-math-1-catalog'],
    ['/DealerDocs/Ed%20Week%20Article.pdf', '/resources#education-week-2013'],
    ['/DDI%206-22-09NEWS%20RELEASE%20(final).pdf', '/research'],
    ['/PR/historical-study.pdf', '/research'],
    ['/DealerDocs/historical-guide.pdf', '/resources'],
    ['/teacher_guide/historical-guide.pdf', '/resources'],
    ['/shortdemo/index.htm', '/demos'],
    ['/Beta/historical-unit', '/curriculum'],
    ['/beta/historical-unit', '/curriculum'],
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
    ['/en', '/'] as const,
    ['/en/about?source=explicit-prefix', '/about?source=explicit-prefix'] as const,
    ...DEMO_CANDIDATE_IDS.slice(0, 1).map((id) => [
      `/en/demos/${id}`,
      `/demos/${id}`,
    ] as const),
  ]) {
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

  const favicon = await request.get('/favicon.ico', {maxRedirects: 0});
  expect(favicon.status()).toBe(308);
  expect(favicon.headers().location).toBe('/icon.svg');
});

test('every sitemap page has one heading, canonical metadata, and the expected language', async ({request}) => {
  const sitemap = await request.get('/sitemap.xml');
  const sitemapText = await sitemap.text();
  const urls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(urls).toHaveLength(sitemapPagePaths.length);
  expect(urls.map((url) => new URL(url).pathname).sort()).toEqual(
    [...sitemapPagePaths].sort(),
  );

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

test.describe('complete public browser experience matrix', () => {
  for (const path of browserExperiencePaths) {
    test(`${path} passes desktop, tablet, and 320px browser checks`, async ({page}) => {
      test.setTimeout(60_000);
      const issues = monitorRuntimeIssues(page);
      const language = path === '/es' || path.startsWith('/es/') ? 'es' : 'en';

      for (const viewport of browserExperienceViewports) {
        await page.setViewportSize({width: viewport.width, height: viewport.height});
        await expectDocument(page, path, language);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(
          overflow,
          `${path} overflows horizontally at ${viewport.name}`,
        ).toBeLessThanOrEqual(1);
        // Axe runs at both width extremes. The tablet pass remains a layout and
        // runtime check so the added breakpoint does not expand scan count.
        if (viewport.runAxe) {
          await expectNoAxeViolations(page, path, viewport.name);
        }
      }

      expectNoRuntimeIssues(issues);
    });
  }
});

test('Spanish Terms hero copy stays inside narrow mobile viewports', {
  tag: '@webkit-smoke',
}, async ({page}) => {
  for (const viewport of [
    {width: 320, height: 740},
    {width: 390, height: 844},
  ] as const) {
    await page.setViewportSize(viewport);
    await expectDocument(page, '/es/terms', 'es');
    await page.evaluate(() => document.fonts.ready);

    const copyBounds = await page.locator('.page-hero__copy').evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      return {
        left: rectangle.left,
        right: rectangle.right,
      };
    });
    const headingOverflow = await page.locator('.page-hero__copy h1').evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    );

    expect(copyBounds.left, `${viewport.width}px hero begins outside the viewport`).toBeGreaterThanOrEqual(0);
    expect(copyBounds.right, `${viewport.width}px hero ends outside the viewport`).toBeLessThanOrEqual(
      viewport.width + 1,
    );
    expect(headingOverflow, `${viewport.width}px hero heading clips its text`).toBeLessThanOrEqual(1);
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
  expect(robotsText).toContain('Disallow: /flash-assets/');
  expect(robotsText).toContain('Sitemap: https://www.helpmath.ai/sitemap.xml');
  for (const id of DEMO_CANDIDATE_IDS) {
    const isPublic = publicDemoIdSet.has(id);
    const indexable = indexableDemoIdSet.has(id);
    for (const path of [`/demos/${id}`, `/es/demos/${id}`]) {
      if (isPublic) expect(robotsText).not.toContain(`Disallow: ${path}`);
      else expect(robotsText).toContain(`Disallow: ${path}`);
    }
    const assetAllow = `Allow: /api/executive-preview/assets/${id}/`;
    if (indexable) expect(robotsText).toContain(assetAllow);
    else expect(robotsText).not.toContain(assetAllow);
  }

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('application/xml');
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('<loc>https://www.helpmath.ai/</loc>');
  expect(sitemapText).toContain('<loc>https://www.helpmath.ai/es</loc>');
  expect(sitemapText).toContain('hreflang="x-default"');
  expect(sitemapText).not.toContain('executive-preview');
  for (const id of DEMO_CANDIDATE_IDS) {
    for (const path of [`/demos/${id}`, `/es/demos/${id}`]) {
      const absolute = `https://www.helpmath.ai${path}`;
      if (indexableDemoIdSet.has(id)) expect(sitemapText).toContain(absolute);
      else expect(sitemapText).not.toContain(absolute);
    }
  }
  for (const legalPath of ['/privacy', '/terms', '/es/privacy', '/es/terms']) {
    if (legalPublicationApproved) {
      expect(sitemapText).toContain(`https://www.helpmath.ai${legalPath}`);
    } else {
      expect(sitemapText).not.toContain(`https://www.helpmath.ai${legalPath}`);
    }
  }
});

for (const path of ['/privacy', '/terms', '/es/privacy', '/es/terms'] as const) {
  test(`${path} follows the repository legal-publication gate`, async ({page}) => {
    const response = await page.goto(path, {waitUntil: 'networkidle'});
    expect(response?.status()).toBe(200);
    if (legalPublicationApproved) {
      expect(response?.headers()['x-robots-tag'] ?? '').not.toContain('noindex');
      await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
        'content',
        /noindex/,
      );
      await expect(page.locator('.legal-meta p')).not.toContainText(/Draft|Borrador/i);
    } else {
      expect(response?.headers()['x-robots-tag']).toBe('noindex, follow');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
      await expect(page.locator('.legal-meta p')).toContainText(
        path.startsWith('/es') ? 'Borrador' : 'Draft',
      );
    }
  });
}
