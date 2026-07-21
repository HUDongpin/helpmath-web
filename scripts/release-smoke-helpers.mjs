const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableHttpStatus(status) {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

export function isStrictIsoUtcTimestamp(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
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
