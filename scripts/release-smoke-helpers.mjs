const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableHttpStatus(status) {
  return RETRYABLE_HTTP_STATUSES.has(status);
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
