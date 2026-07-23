const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEMO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function normalizedUniqueIds(values, label) {
  if (!Array.isArray(values) || values.some((value) =>
    typeof value !== 'string' || !DEMO_ID_PATTERN.test(value)
  )) {
    throw new TypeError(`${label} must contain canonical demo ids`);
  }
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${label} must not contain duplicate demo ids`);
  }
  return [...values];
}

function assertSubset(values, candidates, label) {
  for (const value of values) {
    if (!candidates.has(value)) throw new TypeError(`${label} contains unknown demo ${value}`);
  }
}

export function buildDemoLifecycleSmokeModel({
  assetsById,
  candidateIds,
  headingsByLocale,
  indexableIds,
  publicIds,
  reviewIds,
}) {
  const candidates = normalizedUniqueIds(candidateIds, 'candidateIds');
  const publicDemos = normalizedUniqueIds(publicIds, 'publicIds');
  const reviewDemos = normalizedUniqueIds(reviewIds, 'reviewIds');
  const indexableDemos = normalizedUniqueIds(indexableIds, 'indexableIds');
  const candidateSet = new Set(candidates);
  const publicSet = new Set(publicDemos);
  const reviewSet = new Set(reviewDemos);

  assertSubset(publicDemos, candidateSet, 'publicIds');
  assertSubset(reviewDemos, candidateSet, 'reviewIds');
  assertSubset(indexableDemos, publicSet, 'indexableIds');
  for (const id of publicDemos) {
    if (reviewSet.has(id)) throw new TypeError(`demo ${id} cannot be public and private-review`);
  }

  const ownedAssets = {};
  for (const id of candidates) {
    const assets = assetsById?.[id];
    if (!Array.isArray(assets)) {
      throw new TypeError(`assetsById.${id} must be an array`);
    }
    const prefix = `/api/executive-preview/assets/${id}/`;
    if (
      assets.some((asset) => {
        if (typeof asset !== 'string' || !asset.startsWith(prefix)) return true;
        const suffix = asset.slice(prefix.length);
        return (
          suffix.length === 0 ||
          suffix.includes('\\') ||
          suffix.includes('?') ||
          suffix.includes('#') ||
          suffix.split('/').some((segment) => !segment || segment === '.' || segment === '..')
        );
      }) ||
      new Set(assets).size !== assets.length
    ) {
      throw new TypeError(`assetsById.${id} must contain unique namespaced asset paths`);
    }
    ownedAssets[id] = Object.freeze([...assets]);
  }

  const privateDemos = candidates.filter((id) => !publicSet.has(id));
  const demoRoutes = (ids) => ids.flatMap((id) => [`/demos/${id}`, `/es/demos/${id}`]);
  const assetsFor = (ids) => ids.flatMap((id) => ownedAssets[id]);
  const authenticatedDemoCases = reviewDemos.flatMap((id) => {
    const englishHeading = headingsByLocale?.en?.[id];
    const spanishHeading = headingsByLocale?.es?.[id];
    if (typeof englishHeading !== 'string' || typeof spanishHeading !== 'string') {
      throw new TypeError(`headingsByLocale is missing ${id}`);
    }
    return [
      Object.freeze({path: `/demos/${id}`, locale: 'en', heading: englishHeading}),
      Object.freeze({path: `/es/demos/${id}`, locale: 'es', heading: spanishHeading}),
    ];
  });

  return Object.freeze({
    authenticatedDemoCases: Object.freeze(authenticatedDemoCases),
    indexableDemoIds: Object.freeze(indexableDemos),
    indexableDemoRoutes: Object.freeze(demoRoutes(indexableDemos)),
    privateAssetPaths: Object.freeze(assetsFor(privateDemos)),
    privateDemoIds: Object.freeze(privateDemos),
    privateDemoRoutes: Object.freeze(demoRoutes(privateDemos)),
    publicAssetPaths: Object.freeze(assetsFor(publicDemos)),
    publicDemoIds: Object.freeze(publicDemos),
    publicDemoRoutes: Object.freeze(demoRoutes(publicDemos)),
    reviewAssetPaths: Object.freeze(assetsFor(reviewDemos)),
    reviewDemoIds: Object.freeze(reviewDemos),
    reviewRuntimePaths: Object.freeze(
      reviewDemos.map((id) => `/api/executive-preview/runtime/${id}.js`),
    ),
    runtimeProbePaths: Object.freeze(
      candidates.map((id) => `/api/executive-preview/runtime/${id}.js`),
    ),
  });
}

export function isRetryableHttpStatus(status) {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

export function isStrictIsoUtcTimestamp(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function evaluateCanonicalRedirect(
  {status, location},
  {baseUrl, expectedPath, expectedStatus = 307},
) {
  if (!Number.isInteger(status)) throw new TypeError('status must be an integer');
  if (typeof location !== 'string' && location !== null) {
    throw new TypeError('location must be a string or null');
  }
  if (typeof baseUrl !== 'string' || typeof expectedPath !== 'string') {
    throw new TypeError('baseUrl and expectedPath must be strings');
  }
  if (!Number.isInteger(expectedStatus)) {
    throw new TypeError('expectedStatus must be an integer');
  }

  const base = new URL(baseUrl);
  const expected = new URL(expectedPath, base);
  const failures = [];
  let target = null;

  if (status !== expectedStatus) {
    failures.push(`redirect returned ${status}, expected ${expectedStatus}`);
  }

  try {
    target = location ? new URL(location, base) : null;
  } catch {
    failures.push(`redirect has malformed location ${location}`);
  }

  if (!target) {
    failures.push('redirect is missing its canonical location');
  } else {
    if (target.origin !== base.origin) {
      failures.push(`redirect targets unexpected origin ${target.origin}`);
    }

    const targetPath = `${target.pathname}${target.search}${target.hash}`;
    const canonicalPath = `${expected.pathname}${expected.search}${expected.hash}`;
    if (targetPath !== canonicalPath) {
      failures.push(`redirect targets ${targetPath}, expected ${canonicalPath}`);
    }
  }

  return {
    location: target?.toString() ?? null,
    failures,
  };
}

export function evaluateExecutivePreviewEntries(
  entries,
  {expectedState = 'any', expectedExpiresAt = null, nowMs = Date.now()} = {},
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('entries must be a non-empty array');
  }

  const failures = [];
  const states = new Set(entries.map((entry) => entry.state));
  if (states.size !== 1) {
    failures.push(`executive preview entries disagree on state: ${[...states].join(', ')}`);
  }
  const state = states.size === 1 ? [...states][0] : 'inconsistent';
  if (expectedState !== 'any' && state !== expectedState) {
    failures.push(`executive preview state is ${state}, expected ${expectedState}`);
  }

  const expiryValues = entries.flatMap((entry) =>
    entry.state === 'login' ? entry.expiryValues : [],
  );
  const uniqueExpiryValues = new Set(expiryValues);
  const expiresAt = uniqueExpiryValues.size === 1 ? [...uniqueExpiryValues][0] : null;

  if (state === 'login') {
    if (expiryValues.length !== entries.length || uniqueExpiryValues.size !== 1) {
      failures.push('executive preview entries do not expose the same single review expiry');
    }
    if (!isStrictIsoUtcTimestamp(expiresAt) || Date.parse(expiresAt) <= nowMs) {
      failures.push('executive preview expiry is malformed or not in the future');
    }
  }
  if (state === 'unavailable' && expiryValues.length > 0) {
    failures.push('unavailable executive preview entries must not expose an expiry');
  }
  if (expectedExpiresAt && expiresAt !== expectedExpiresAt) {
    failures.push(
      `executive preview expiry is ${expiresAt ?? 'missing'}, expected ${expectedExpiresAt}`,
    );
  }

  return {state, expiresAt, failures};
}

export function evaluateExecutivePreviewLifecycle(
  {state, expiresAt},
  {maximumExpiresAt, nowMs = Date.now()},
) {
  if (!isStrictIsoUtcTimestamp(maximumExpiresAt)) {
    throw new TypeError('maximumExpiresAt must be a canonical UTC timestamp');
  }
  if (!Number.isFinite(nowMs)) throw new TypeError('nowMs must be finite');

  const failures = [];
  const maximumExpiresAtMs = Date.parse(maximumExpiresAt);
  const beforeApprovedClose = nowMs < maximumExpiresAtMs;

  if (beforeApprovedClose) {
    if (state === 'login' && expiresAt !== maximumExpiresAt) {
      failures.push(
        `active executive preview expiry is ${expiresAt ?? 'missing'}, expected ${maximumExpiresAt}`,
      );
    } else if (state !== 'login' && state !== 'unavailable') {
      failures.push(`executive preview state is ${state}, expected login or unavailable`);
    }
  } else if (state !== 'unavailable') {
    failures.push(`executive preview state is ${state}, expected unavailable after approved close`);
  }

  if (state === 'unavailable' && expiresAt !== null) {
    failures.push('unavailable executive preview must not expose an expiry');
  }

  return {
    phase: beforeApprovedClose ? 'review-window' : 'post-expiry',
    state,
    expiresAt,
    maximumExpiresAt,
    failures,
  };
}

export function retryDelayMs(attempt, baseDelayMs, maxDelayMs) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new TypeError('attempt must be a positive integer');
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new TypeError('baseDelayMs must be a non-negative number');
  }
  if (!Number.isFinite(maxDelayMs) || maxDelayMs < baseDelayMs) {
    throw new TypeError('maxDelayMs must be at least baseDelayMs');
  }

  return Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
}

export async function retryOperation(
  operation,
  {
    maxAttempts,
    shouldRetryResult = () => false,
    shouldRetryError = () => true,
    delayForAttempt = () => 0,
    sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  },
) {
  if (typeof operation !== 'function') {
    throw new TypeError('operation must be a function');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('maxAttempts must be a positive integer');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await operation(attempt);
      if (attempt === maxAttempts || !shouldRetryResult(result, attempt)) {
        return result;
      }
      await sleep(delayForAttempt(attempt, result));
    } catch (error) {
      if (attempt === maxAttempts || !shouldRetryError(error, attempt)) {
        throw error;
      }
      await sleep(delayForAttempt(attempt, undefined, error));
    }
  }

  throw new Error('retryOperation reached an unreachable state');
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('concurrency must be a positive integer');
  }
  if (typeof mapper !== 'function') {
    throw new TypeError('mapper must be a function');
  }

  const values = Array.from(items);
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({length: workerCount}, () => worker()));
  return results;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function attributesFromTag(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/gu)) {
    attributes[match[1].toLowerCase()] = decodeHtmlAttribute(match[2]);
  }
  return attributes;
}

export function inspectExecutivePreviewEntry(markup) {
  if (typeof markup !== 'string') {
    throw new TypeError('markup must be a string');
  }

  const loginForms = (markup.match(/<form\b[^>]*>[\s\S]*?<\/form>/giu) ?? []).filter(
    (form) => {
      const openingTag = form.match(/^<form\b[^>]*>/iu)?.[0] ?? '';
      const attributes = attributesFromTag(openingTag);
      return (
        attributes.action === '/api/executive-preview/session' &&
        attributes.method?.toLowerCase() === 'post'
      );
    },
  );
  const hasLoginForm = loginForms.length > 0;
  const hasPassphraseField = loginForms.some((form) => {
    return (form.match(/<input\b[^>]*>/giu) ?? []).some((tag) => {
      const attributes = attributesFromTag(tag);
      return attributes.name === 'passphrase' && attributes.type?.toLowerCase() === 'password';
    });
  });
  const unavailableLocales = [];
  if (markup.includes('Executive preview is unavailable')) unavailableLocales.push('en');
  if (markup.includes('La vista previa ejecutiva no está disponible')) {
    unavailableLocales.push('es');
  }
  const hasUnavailableNotice = unavailableLocales.length > 0;
  const expiryValues = (markup.match(/<time\b[^>]*>/giu) ?? []).flatMap((tag) => {
    const value = attributesFromTag(tag).datetime;
    return value ? [value] : [];
  });

  const state =
    hasLoginForm && hasPassphraseField && !hasUnavailableNotice
      ? 'login'
      : !hasLoginForm && !hasPassphraseField && hasUnavailableNotice
        ? 'unavailable'
        : 'unknown';

  return {
    state,
    hasLoginForm,
    hasPassphraseField,
    hasUnavailableNotice,
    unavailableLocales,
    expiryValues,
  };
}
