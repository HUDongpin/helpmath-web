const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? 'https://www.helpmath.ai');
const canonicalBaseUrl = new URL(
  process.env.SMOKE_CANONICAL_ORIGIN ?? 'https://www.helpmath.ai',
);
const expectContactEnabled = process.env.EXPECT_CONTACT_ENABLED === 'true';
const fetchTimeoutMs = Number(process.env.SMOKE_FETCH_TIMEOUT_MS ?? 20_000);
const vercelBypassSecret = process.env.SMOKE_VERCEL_BYPASS_SECRET?.trim();

for (const [name, value] of [
  ['SMOKE_BASE_URL', baseUrl],
  ['SMOKE_CANONICAL_ORIGIN', canonicalBaseUrl],
]) {
  if (!['http:', 'https:'].includes(value.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }
  value.pathname = '/';
  value.search = '';
  value.hash = '';
}

if (!Number.isFinite(fetchTimeoutMs) || fetchTimeoutMs < 1_000) {
  throw new Error('SMOKE_FETCH_TIMEOUT_MS must be a number of at least 1000.');
}

const origin = baseUrl.origin;
const canonicalOrigin = canonicalBaseUrl.origin;
const failures = [];

const contentRoutes = [
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
];

const privateDemoRoutes = [
  '/demos/conversion-1-2',
  '/demos/conversion-1-4',
  '/es/demos/conversion-1-2',
  '/es/demos/conversion-1-4',
];

const privateDemoAssets = [
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
];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function url(path) {
  return new URL(path, baseUrl).toString();
}

function canonicalUrl(path) {
  return new URL(path, canonicalBaseUrl).toString();
}

async function fetchWithTimeout(target, init = {}) {
  const method = (init.method ?? 'GET').toUpperCase();
  const attempts = method === 'GET' || method === 'HEAD' ? 2 : 1;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(fetchTimeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const headers = new Headers(init.headers);
      if (vercelBypassSecret) {
        headers.set('x-vercel-protection-bypass', vercelBypassSecret);
      }
      return await fetch(target, {redirect: 'manual', ...init, headers, signal});
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Request failed for ${target} after ${attempts} attempt(s): ${detail}`);
}

async function get(path, init = {}) {
  return fetchWithTimeout(url(path), init);
}

function decodeMarkup(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function attributesFrom(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
    attributes[match[1].toLowerCase()] = decodeMarkup(match[2]);
  }
  return attributes;
}

function canonicalFrom(html) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = attributesFrom(tag);
    if (attributes.rel?.toLowerCase().split(/\s+/).includes('canonical')) {
      return attributes.href ?? null;
    }
  }
  return null;
}

function titleFrom(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeMarkup(title.replace(/<[^>]*>/g, '').trim()) : null;
}

function visibleTextFrom(html) {
  return decodeMarkup(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, canonicalBaseUrl).toString();
  } catch {
    return null;
  }
}

function robotsDirectives(value) {
  return new Set(
    (value ?? '')
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean),
  );
}

function hasRobotsHeader(response, expected) {
  const directives = robotsDirectives(response.headers.get('x-robots-tag'));
  return expected.every((directive) => directives.has(directive));
}

function hasRobotsMeta(html, expected) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return tags.some((tag) => {
    const attributes = attributesFrom(tag);
    if (attributes.name?.toLowerCase() !== 'robots') return false;
    const directives = robotsDirectives(attributes.content);
    return expected.every((directive) => directives.has(directive));
  });
}

function alternateLinksFrom(markup) {
  const tags = markup.match(/<(?:[a-z]+:)?link\b[^>]*>/gi) ?? [];
  return tags.flatMap((tag) => {
    const attributes = attributesFrom(tag);
    const rel = attributes.rel?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.includes('alternate') || !attributes.hreflang || !attributes.href) return [];
    return [{language: attributes.hreflang.toLowerCase(), href: attributes.href}];
  });
}

function checkAlternateLinks(markup, expected, label) {
  const links = alternateLinksFrom(markup);
  const result = {};

  for (const [language, expectedHref] of Object.entries(expected)) {
    const matching = links.filter((link) => link.language === language);
    if (matching.length !== 1) {
      check(false, `${label} has ${matching.length} ${language} alternate links, expected 1`);
      result[language] = null;
      continue;
    }
    const actualHref = matching[0]?.href ?? null;
    result[language] = normalizedUrl(actualHref);
    check(
      normalizedUrl(actualHref) === normalizedUrl(expectedHref),
      `${label} has ${language} alternate ${actualHref ?? 'missing'}, expected ${expectedHref}`,
    );
  }

  return result;
}

function expectedPage(locale, route) {
  const path = locale === 'es' ? `/es${route === '/' ? '' : route}` : route;
  return {
    locale,
    route,
    path,
    canonical: canonicalUrl(path),
    alternates: {
      en: canonicalUrl(route),
      es: canonicalUrl(`/es${route === '/' ? '' : route}`),
      'x-default': canonicalUrl(route),
    },
  };
}

const expectedPages = contentRoutes.flatMap((route) => [
  expectedPage('en', route),
  expectedPage('es', route),
]);
const expectedSitemapUrls = expectedPages.map((page) => page.canonical).sort();

const sitemapResponse = await get('/sitemap.xml');
check(sitemapResponse.status === 200, `sitemap.xml returned ${sitemapResponse.status}`);
check(
  sitemapResponse.headers.get('content-type')?.includes('xml'),
  `sitemap.xml has content-type ${sitemapResponse.headers.get('content-type') ?? 'missing'}`,
);
const sitemap = await sitemapResponse.text();
const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
  const block = match[1];
  const loc = block.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim();
  return {block, loc: loc ? decodeMarkup(loc) : null};
});
const sitemapUrls = sitemapEntries.flatMap((entry) => (entry.loc ? [entry.loc] : []));
const uniqueSitemapUrls = new Set(sitemapUrls);

check(sitemapEntries.length === sitemapUrls.length, 'sitemap.xml contains a URL entry without loc');
check(
  sitemapUrls.length === expectedSitemapUrls.length,
  `sitemap.xml contains ${sitemapUrls.length} pages, expected exactly ${expectedSitemapUrls.length}`,
);
check(
  uniqueSitemapUrls.size === sitemapUrls.length,
  `sitemap.xml contains ${sitemapUrls.length - uniqueSitemapUrls.size} duplicate loc entries`,
);
for (const expectedUrl of expectedSitemapUrls) {
  check(uniqueSitemapUrls.has(expectedUrl), `sitemap.xml is missing ${expectedUrl}`);
}
for (const actualUrl of [...uniqueSitemapUrls].sort()) {
  check(expectedSitemapUrls.includes(actualUrl), `sitemap.xml contains unexpected URL ${actualUrl}`);
}

for (const page of expectedPages) {
  const entry = sitemapEntries.find((candidate) => candidate.loc === page.canonical);
  check(Boolean(entry), `sitemap.xml is missing the entry for ${page.canonical}`);
  if (entry) checkAlternateLinks(entry.block, page.alternates, `sitemap entry ${page.canonical}`);
}

for (const draftPath of ['/privacy', '/terms', '/es/privacy', '/es/terms']) {
  check(!uniqueSitemapUrls.has(canonicalUrl(draftPath)), `${draftPath} must stay outside the sitemap while draft`);
}
for (const previewPath of privateDemoRoutes) {
  check(
    !uniqueSitemapUrls.has(canonicalUrl(previewPath)),
    `${previewPath} must stay outside the sitemap until publication approval`,
  );
}

const internalLinks = new Map();
const publicPages = await Promise.all(
  expectedPages.map(async (page) => {
    const response = await get(page.path);
    const html = await response.text();
    const language = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1] ?? null;
    const h1Count = (html.match(/<h1\b/gi) ?? []).length;
    const canonical = canonicalFrom(html);
    const title = titleFrom(html);

    check(response.status === 200, `${page.path} returned ${response.status}`);
    check(language === page.locale, `${page.path} has lang=${language ?? 'missing'}`);
    check(h1Count === 1, `${page.path} has ${h1Count} h1 elements`);
    check(title?.includes('HELP Math'), `${page.path} has unbranded title ${title ?? 'missing'}`);
    check(
      normalizedUrl(canonical) === normalizedUrl(page.canonical),
      `${page.path} has canonical ${canonical ?? 'missing'}, expected ${page.canonical}`,
    );
    const alternates = checkAlternateLinks(html, page.alternates, `page ${page.path}`);

    for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
      try {
        const candidate = new URL(decodeMarkup(match[1]), page.canonical);
        if (
          [origin, canonicalOrigin].includes(candidate.origin) &&
          !candidate.pathname.startsWith('/_next/')
        ) {
          candidate.hash = '';
          const requestPath = `${candidate.pathname}${candidate.search}`;
          internalLinks.set(canonicalUrl(requestPath), requestPath);
        }
      } catch {
        // Ignore non-URL values; rendered navigation is covered by the page checks.
      }
    }

    return {page, alternates, status: response.status, html};
  }),
);

for (const result of publicPages.filter(({page}) => ['/', '/demos'].includes(page.route))) {
  for (const privatePath of privateDemoRoutes) {
    check(
      !result.html.includes(`href="${privatePath}"`),
      `${result.page.path} links to private demo route ${privatePath}`,
    );
  }
  check(
    !result.html.includes('/flash-assets/'),
    `${result.page.path} references a private demo asset`,
  );
}

for (const route of contentRoutes) {
  const english = publicPages.find((result) => result.page.route === route && result.page.locale === 'en');
  const spanish = publicPages.find((result) => result.page.route === route && result.page.locale === 'es');
  check(Boolean(english && spanish), `${route} is missing an English/Spanish page pair`);
  if (english && spanish) {
    for (const language of ['en', 'es', 'x-default']) {
      check(
        english.alternates[language] === spanish.alternates[language],
        `${route} has non-reciprocal ${language} page alternates`,
      );
    }
  }
}

const checkedLinks = await Promise.all(
  [...internalLinks.entries()].sort().map(async ([link, requestPath]) => {
    const response = await get(requestPath);
    await response.arrayBuffer();
    check(response.status < 300, `internal link ${link} returned ${response.status}`);
    return {link, status: response.status};
  }),
);

function relativeRedirectLocation(location, requestPath) {
  if (!location) return null;
  try {
    const parsed = new URL(location, url(requestPath));
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

const englishPrefixRedirects = [
  ['/en?source=release-smoke', '/?source=release-smoke'],
  ['/en/about', '/about'],
  ['/en/demos/conversion-1-2?source=release-smoke', '/demos/conversion-1-2?source=release-smoke'],
];

for (const [path, destination] of englishPrefixRedirects) {
  const response = await get(path);
  await response.arrayBuffer();
  const location = relativeRedirectLocation(response.headers.get('location'), path);
  check(response.status === 308, `${path} returned ${response.status}, expected 308`);
  check(location === destination, `${path} redirected to ${location ?? 'missing'}, expected ${destination}`);
}

const legacyRedirects = [
  ['/Contact.htm?source=cutover&campaign=legacy', '/contact?source=cutover&campaign=legacy'],
  ['/Kf.htm', '/about'],
  ['/Mph.htm', '/about'],
  ['/Sheltered%20Instruction.wmv?download=1', '/approach?download=1'],
  ['/Sheltered.htm', '/approach'],
  ['/student_login.aspx?district=demo', '/login?district=demo'],
  ['/Project_Admin_Login.aspx', '/login'],
  ['/PR.htm', '/research'],
  ['/DDI%206-22-09NEWS%20RELEASE%20(final).pdf', '/research'],
  ['/teacher_guide/historical-guide.pdf?lang=en', '/resources?lang=en'],
  ['/PR/historical-study.pdf', '/research'],
];

for (const [path, destination] of legacyRedirects) {
  const response = await get(path);
  await response.arrayBuffer();
  const location = relativeRedirectLocation(response.headers.get('location'), path);
  check(response.status === 308, `${path} returned ${response.status}, expected 308`);
  check(location === destination, `${path} redirected to ${location ?? 'missing'}, expected ${destination}`);
}

for (const path of [
  '/Images/Help_Slideshow.swf',
  '/0214%20Sunburst%20and%20BLI%20Form%20partnership%20for%20HELP%20Math2.pdf',
]) {
  const response = await get(path);
  await response.arrayBuffer();
  check(response.status === 404, `${path} returned ${response.status}, expected 404`);
  check(
    hasRobotsHeader(response, ['noindex', 'nofollow']),
    `${path} is missing X-Robots-Tag: noindex, nofollow`,
  );
}

const brandedNotFoundCases = [
  {path: '/release-smoke-missing', locale: 'en', heading: 'Page not found'},
  {path: '/release-smoke.missing', locale: 'en', heading: 'Page not found'},
  {path: '/apiary', locale: 'en', heading: 'Page not found'},
  {path: '/_nextish', locale: 'en', heading: 'Page not found'},
  {path: '/_vercelish', locale: 'en', heading: 'Page not found'},
  {path: '/es/release-smoke-missing', locale: 'es', heading: 'Página no encontrada'},
  {path: '/es/release-smoke.missing', locale: 'es', heading: 'Página no encontrada'},
];

for (const testCase of brandedNotFoundCases) {
  const response = await get(testCase.path);
  const html = await response.text();
  const visibleText = visibleTextFrom(html);
  const language = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1] ?? null;
  const title = titleFrom(html);
  check(response.status === 404, `${testCase.path} returned ${response.status}, expected 404`);
  check(language === testCase.locale, `${testCase.path} has lang=${language ?? 'missing'}`);
  check(title?.includes('HELP Math'), `${testCase.path} has unbranded title ${title ?? 'missing'}`);
  check(visibleText.includes(testCase.heading), `${testCase.path} is missing heading ${testCase.heading}`);
  check(/HELP Math/i.test(visibleText), `${testCase.path} is missing the HELP Math brand`);
  check(
    hasRobotsHeader(response, ['noindex', 'nofollow']),
    `${testCase.path} is missing X-Robots-Tag: noindex, nofollow`,
  );
  check(
    hasRobotsMeta(html, ['noindex']),
    `${testCase.path} is missing a noindex robots meta tag`,
  );
}

for (const path of privateDemoRoutes) {
  const response = await get(path);
  const html = await response.text();
  check(response.status === 404, `${path} returned ${response.status}, expected private 404`);
  check(
    hasRobotsHeader(response, ['noindex', 'nofollow']),
    `${path} is missing the private X-Robots-Tag boundary`,
  );
  check(hasRobotsMeta(html, ['noindex']), `${path} is missing a noindex robots meta tag`);
}

for (const path of privateDemoAssets) {
  const response = await get(path);
  const contentType = response.headers.get('content-type') ?? '';
  await response.arrayBuffer();
  check(response.status === 404, `${path} returned ${response.status}, expected private 404`);
  check(!contentType.startsWith('image/'), `${path} exposed image content as ${contentType}`);
  check(
    hasRobotsHeader(response, ['noindex', 'nofollow']),
    `${path} is missing the private X-Robots-Tag boundary`,
  );
}

for (const path of [
  '/_next/image?url=%2Fflash-assets%2Fcylinder-base.png&w=640&q=75',
  '/_vercel/image?url=%2Fflash-assets%2Fcylinder-base.png&w=640&q=75',
]) {
  const response = await get(path);
  const contentType = response.headers.get('content-type') ?? '';
  await response.arrayBuffer();
  check(response.status !== 200, `${path} bypassed the private asset boundary`);
  check(!contentType.startsWith('image/'), `${path} exposed optimized image content as ${contentType}`);
}

for (const path of ['/privacy', '/terms', '/es/privacy', '/es/terms']) {
  const response = await get(path);
  const html = await response.text();
  const visibleText = visibleTextFrom(html);
  check(response.status === 200, `${path} returned ${response.status}`);
  check(
    hasRobotsHeader(response, ['noindex', 'follow']),
    `${path} is missing X-Robots-Tag: noindex, follow`,
  );
  check(
    hasRobotsMeta(html, ['noindex', 'follow']),
    `${path} is missing the matching robots meta tag`,
  );
  check(/draft|borrador/i.test(visibleText), `${path} is missing its visible draft notice`);
}

const staticAssets = [
  {path: '/icon.svg', contentType: 'image/svg+xml', text: /<svg\b/i},
  {path: '/manifest.webmanifest', contentType: 'application/manifest+json', text: /HELP Math/i},
  {path: '/opengraph-image.png', contentType: 'image/png'},
  {path: '/robots.txt', contentType: 'text/plain', text: /sitemap:/i},
];

for (const asset of staticAssets) {
  const response = await get(asset.path);
  const body = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') ?? '';
  check(response.status === 200, `${asset.path} returned ${response.status}`);
  check(
    contentType.includes(asset.contentType),
    `${asset.path} has content-type ${contentType || 'missing'}, expected ${asset.contentType}`,
  );
  check(body.byteLength > 0, `${asset.path} returned an empty body`);
  if (asset.text) {
    check(asset.text.test(new TextDecoder().decode(body)), `${asset.path} has unexpected text content`);
  }
}

const homeResponse = await get('/');
const requiredHeaders = {
  'content-security-policy': ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'"],
  'cross-origin-opener-policy': ['same-origin-allow-popups'],
  'permissions-policy': ['camera=()', 'microphone=()', 'geolocation=()'],
  'referrer-policy': ['strict-origin-when-cross-origin'],
  'strict-transport-security': ['max-age=63072000', 'includeSubDomains'],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['DENY'],
};

for (const [header, expectedParts] of Object.entries(requiredHeaders)) {
  const value = homeResponse.headers.get(header) ?? '';
  for (const expected of expectedParts) {
    check(value.includes(expected), `home response ${header} is missing ${expected}`);
  }
}
check(!homeResponse.headers.has('x-powered-by'), 'home response exposes X-Powered-By');
await homeResponse.arrayBuffer();

const contactPages = [
  {
    path: '/contact',
    closedCopy: /not accepting messages|still being configured|contact (?:form|intake).{0,80}(?:unavailable|closed)/i,
  },
  {
    path: '/es/contact',
    closedCopy: /aún no acepta mensajes|todavía se están configurando|(?:formulario|recepción).{0,80}(?:no disponible|cerrad[ao]|no acepta)/i,
  },
];

for (const contact of contactPages) {
  const response = await get(contact.path);
  const html = await response.text();
  const visibleText = visibleTextFrom(html);
  check(response.status === 200, `${contact.path} returned ${response.status}`);
  if (expectContactEnabled) {
    check(/<form\b/i.test(html), `${contact.path} does not render an enabled contact form`);
  } else {
    check(!/<form\b/i.test(html), `${contact.path} renders a form while contact intake is disabled`);
    check(
      contact.closedCopy.test(visibleText),
      `${contact.path} does not visibly explain that contact intake is unavailable`,
    );
  }
}

if (!expectContactEnabled) {
  const contactResponse = await get('/api/contact', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      name: 'Release smoke test',
      email: 'release-smoke@example.com',
      message: 'This synthetic request must not be delivered while intake is disabled.',
      privacyConsent: true,
      website: '',
    }),
  });
  const contactBody = await contactResponse.json().catch(() => null);
  check(contactResponse.status === 503, `contact API returned ${contactResponse.status}, expected 503`);
  check(
    contactResponse.headers.get('cache-control')?.toLowerCase().includes('no-store'),
    'disabled contact API response is missing Cache-Control: no-store',
  );
  check(
    contactBody?.error?.code === 'CONTACT_DISABLED',
    `contact API returned ${contactBody?.error?.code ?? 'no error code'}, expected CONTACT_DISABLED`,
  );
}

let domainMatrixCases = 0;
if (origin === 'https://www.helpmath.ai') {
  const targets = ['/', '/research?source=release-smoke&campaign=domain-matrix'];
  for (const target of targets) {
    const cases = [
      {
        request: `http://helpmath.ai${target}`,
        status: 308,
        location: `https://helpmath.ai${target}`,
      },
      {
        request: `https://helpmath.ai${target}`,
        status: 308,
        location: `https://www.helpmath.ai${target}`,
      },
      {
        request: `http://www.helpmath.ai${target}`,
        status: 308,
        location: `https://www.helpmath.ai${target}`,
      },
      {request: `https://www.helpmath.ai${target}`, status: 200, location: null},
    ];

    for (const testCase of cases) {
      domainMatrixCases += 1;
      const response = await fetchWithTimeout(testCase.request);
      await response.arrayBuffer();
      const location = response.headers.get('location');
      check(
        response.status === testCase.status,
        `${testCase.request} returned ${response.status}, expected ${testCase.status}`,
      );
      check(
        location === testCase.location,
        `${testCase.request} has location ${location ?? 'none'}, expected ${testCase.location ?? 'none'}`,
      );
    }
  }
}

const summary = {
  baseUrl: origin,
  canonicalOrigin,
  fetchTimeoutMs,
  expectedSitemapPages: expectedSitemapUrls.length,
  publicPages: publicPages.length,
  internalLinks: checkedLinks.length,
  englishPrefixRedirects: englishPrefixRedirects.length,
  legacyRedirects: legacyRedirects.length,
  brandedNotFoundCases: brandedNotFoundCases.length,
  privateDemoRoutes: privateDemoRoutes.length,
  privateDemoAssets: privateDemoAssets.length,
  privateDemoOptimizerProbes: 2,
  staticAssets: staticAssets.length,
  legalDrafts: 4,
  domainMatrixCases,
  contactExpectation: expectContactEnabled ? 'enabled' : 'disabled',
  protectedPreviewAuth: Boolean(vercelBypassSecret),
  failures,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) process.exitCode = 1;
