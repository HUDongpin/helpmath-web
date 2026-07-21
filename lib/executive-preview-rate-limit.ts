import {isIP} from 'node:net';

export const EXECUTIVE_PREVIEW_FAILURE_LIMIT = 8;
export const EXECUTIVE_PREVIEW_FAILURE_WINDOW_MS = 15 * 60 * 1_000;

const MAX_TRACKED_CLIENTS = 1_024;

type FailureEntry = {
  failures: number;
  resetAt: number;
};

export type ExecutivePreviewRateLimit = {
  blocked: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function availableResult(): ExecutivePreviewRateLimit {
  return {
    blocked: false,
    remaining: EXECUTIVE_PREVIEW_FAILURE_LIMIT,
    retryAfterSeconds: 0,
  };
}

export function getExecutivePreviewClientIdentifier(headers: Headers): string {
  const forwarded =
    headers.get('x-vercel-forwarded-for') ??
    headers.get('x-forwarded-for') ??
    headers.get('x-real-ip') ??
    '';
  const candidate = forwarded.split(',', 1)[0]?.trim() ?? '';

  // Vercel replaces the forwarding address at the trusted edge. Invalid or
  // absent values share a conservative fallback bucket rather than creating
  // attacker-controlled map keys.
  return isIP(candidate) > 0 ? candidate.toLowerCase() : 'unknown';
}

export class ExecutivePreviewFailureLimiter {
  readonly #entries = new Map<string, FailureEntry>();

  check(client: string, now = Date.now()): ExecutivePreviewRateLimit {
    if (!Number.isFinite(now)) return {blocked: true, remaining: 0, retryAfterSeconds: 1};
    const entry = this.#entries.get(client);
    if (!entry) return availableResult();
    if (entry.resetAt <= now) {
      this.#entries.delete(client);
      return availableResult();
    }

    return {
      blocked: entry.failures >= EXECUTIVE_PREVIEW_FAILURE_LIMIT,
      remaining: Math.max(0, EXECUTIVE_PREVIEW_FAILURE_LIMIT - entry.failures),
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
    };
  }

  recordFailure(client: string, now = Date.now()): ExecutivePreviewRateLimit {
    if (!Number.isFinite(now)) return {blocked: true, remaining: 0, retryAfterSeconds: 1};
    const current = this.#entries.get(client);
    const entry = current && current.resetAt > now
      ? {failures: current.failures + 1, resetAt: current.resetAt}
      : {failures: 1, resetAt: now + EXECUTIVE_PREVIEW_FAILURE_WINDOW_MS};

    if (!current && this.#entries.size >= MAX_TRACKED_CLIENTS) {
      this.#prune(now);
      if (this.#entries.size >= MAX_TRACKED_CLIENTS) {
        const oldestClient = this.#entries.keys().next().value;
        if (oldestClient) this.#entries.delete(oldestClient);
      }
    }
    this.#entries.delete(client);
    this.#entries.set(client, entry);
    return this.check(client, now);
  }

  clear(client: string): void {
    this.#entries.delete(client);
  }

  #prune(now: number): void {
    for (const [client, entry] of this.#entries) {
      if (entry.resetAt <= now) this.#entries.delete(client);
    }
  }
}
