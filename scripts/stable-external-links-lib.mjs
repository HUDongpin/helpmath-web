import { lookup as systemLookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { resolve } from "node:path";

export const GOVERNED_SOURCE_DOCUMENTS = Object.freeze([
  "docs/CONTENT_SOURCES.md",
  "docs/LEGACY_RESOURCE_MAP.md",
]);

export const LEGACY_SOURCE_REGISTRY = "data/legacy-source-registry.json";
export const EXCLUDED_LEGACY_ORIGIN = "https://www.helpprogram.net";

export const APPROVED_HOSTNAMES = Object.freeze([
  "boulderlearning.com",
  "codieawards.com",
  "doi.org",
  "edtechdigest.com",
  "edweek.org",
  "eric.ed.gov",
  "ies.ed.gov",
  "lexingtoninstitute.org",
  "linkinghub.elsevier.com",
  "pedanova.tech",
  "sciencedirect.com",
  "solve.mit.edu",
  "www.boulderlearning.com",
  "www.codieawards.com",
  "www.edtechdigest.com",
  "www.edweek.org",
  "www.ies.ed.gov",
  "www.lexingtoninstitute.org",
  "www.pedanova.tech",
  "www.sciencedirect.com",
]);

export const REQUEST_POLICY = Object.freeze({
  timeoutMs: 8_000,
  maxAttempts: 2,
  maxRedirects: 4,
  concurrency: 4,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 1_000,
  retryableHttpStatuses: Object.freeze([408, 425, 429, 500, 502, 503, 504]),
});

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CATEGORIES = new Set(["award", "partner", "publisher", "research"]);
const APPROVED_HOSTNAME_SET = new Set(APPROVED_HOSTNAMES);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
]) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

export class StableLinkError extends Error {
  constructor(code, { retryable = false, status } = {}) {
    super(code);
    this.name = "StableLinkError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

export function extractHttpsLinks(markdown) {
  const links = [];
  const pattern = /\]\((https:\/\/[^\s)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    links.push(match[1]);
  }
  return sortedUnique(links);
}

export function assertSafeRequestUrl(value, allowedRedirectHosts) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new StableLinkError("invalid-url");
  }

  if (url.protocol !== "https:") {
    throw new StableLinkError("https-required");
  }
  if (url.username || url.password) {
    throw new StableLinkError("credentials-forbidden");
  }
  if (url.port && url.port !== "443") {
    throw new StableLinkError("custom-port-forbidden");
  }
  if (url.hash) {
    throw new StableLinkError("fragment-forbidden");
  }

  const hostname = normalizeHostname(url.hostname);
  if (isIP(hostname) !== 0) {
    throw new StableLinkError("ip-literal-forbidden");
  }

  const normalizedAllowedHosts = new Set(
    Array.isArray(allowedRedirectHosts)
      ? allowedRedirectHosts.map(normalizeHostname)
      : [],
  );
  if (!normalizedAllowedHosts.has(hostname)) {
    throw new StableLinkError("redirect-host-not-allowed");
  }
  if (!APPROVED_HOSTNAME_SET.has(hostname)) {
    throw new StableLinkError("hostname-not-approved");
  }

  return url;
}

export function isPublicIpAddress(address) {
  const family = isIP(address);
  if (family === 0) return false;
  return family === 4
    ? !blockedIpv4Addresses.check(address, "ipv4")
    : !blockedIpv6Addresses.check(address, "ipv6");
}

export async function resolvePublicAddresses(hostname, lookup = systemLookup) {
  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new StableLinkError("dns-resolution-failed", { retryable: true });
  }

  const normalized = records
    .filter((record) => record && (record.family === 4 || record.family === 6))
    .map((record) => ({ address: record.address, family: record.family }))
    .sort((left, right) =>
      `${left.family}:${left.address}`.localeCompare(`${right.family}:${right.address}`),
    );

  if (normalized.length === 0) {
    throw new StableLinkError("dns-no-addresses", { retryable: true });
  }
  if (normalized.some((record) => !isPublicIpAddress(record.address))) {
    throw new StableLinkError("dns-non-public-address");
  }

  return normalized;
}

function pinnedLookup(record) {
  return (_hostname, options, callback) => {
    const requestedOptions = typeof options === "object" && options ? options : {};
    const done = typeof options === "function" ? options : callback;
    if (requestedOptions.all) {
      done(null, [record]);
      return;
    }
    done(null, record.address, record.family);
  };
}

function requestTimeoutError() {
  return new StableLinkError("request-timeout", { retryable: true });
}

async function withWallClockTimeout(operation, timeoutMs) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => rejectPromise(requestTimeoutError()), timeoutMs);
    Promise.resolve(operation).then(
      (value) => {
        clearTimeout(timeout);
        resolvePromise(value);
      },
      (error) => {
        clearTimeout(timeout);
        rejectPromise(error);
      },
    );
  });
}

/**
 * @param {URL} url
 * @param {{
 *   timeoutMs: number,
 *   lookup?: typeof systemLookup,
 *   request?: typeof httpsRequest,
 * }} options
 */
export async function requestHttpsHeaders(
  url,
  { timeoutMs, lookup = systemLookup, request = httpsRequest },
) {
  const deadline = Date.now() + timeoutMs;
  const addresses = await withWallClockTimeout(
    resolvePublicAddresses(url.hostname, lookup),
    timeoutMs,
  );
  const pinnedAddress = addresses[0];
  const remainingMs = Math.max(1, deadline - Date.now());

  return await new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let wallClockTimeout;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallClockTimeout);
      callback(value);
    };

    const req = request(url, {
      method: "GET",
      agent: false,
      lookup: pinnedLookup(pinnedAddress),
      servername: url.hostname,
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "identity",
        Range: "bytes=0-0",
        "User-Agent": "HELP-Math-stable-link-check/1.0",
      },
    });

    req.once("response", (response) => {
      const location = Array.isArray(response.headers.location)
        ? response.headers.location[0]
        : response.headers.location;
      response.destroy();
      finish(resolvePromise, {
        status: response.statusCode ?? 0,
        location,
      });
    });
    req.once("error", (error) => {
      const code = error?.code === "ETIMEDOUT" ? "request-timeout" : "network-error";
      finish(
        rejectPromise,
        new StableLinkError(code, { retryable: true }),
      );
    });
    const destroyForTimeout = () => {
      const error = new Error("request-timeout");
      error.code = "ETIMEDOUT";
      req.destroy(error);
    };
    wallClockTimeout = setTimeout(destroyForTimeout, remainingMs);
    req.setTimeout(remainingMs, destroyForTimeout);
    req.end();
  });
}

export async function probeLinkOnce(
  entry,
  policy = REQUEST_POLICY,
  { request = requestHttpsHeaders } = {},
) {
  let current = entry.url;
  let redirects = 0;

  while (true) {
    const url = assertSafeRequestUrl(current, entry.allowedRedirectHosts);
    const response = await request(url, { timeoutMs: policy.timeoutMs });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return { status: response.status, finalUrl: url.href, redirects };
    }
    if (!response.location) {
      throw new StableLinkError("redirect-location-missing", {
        status: response.status,
      });
    }
    if (redirects >= policy.maxRedirects) {
      throw new StableLinkError("redirect-limit-exceeded", {
        status: response.status,
      });
    }

    let next;
    try {
      next = new URL(response.location, url);
    } catch {
      throw new StableLinkError("invalid-redirect-location", {
        status: response.status,
      });
    }
    assertSafeRequestUrl(next.href, entry.allowedRedirectHosts);
    current = next.href;
    redirects += 1;
  }
}

function publicFinalUrl(finalUrl, registeredUrl) {
  if (!finalUrl || finalUrl === registeredUrl) return undefined;
  const parsed = new URL(finalUrl);
  return `${parsed.origin}${parsed.pathname}`;
}

function failureFrom(error) {
  if (error instanceof StableLinkError) return error;
  return new StableLinkError("unexpected-error");
}

function retryDelayMs(failedAttempt, policy) {
  return Math.min(
    policy.retryBaseDelayMs * 2 ** Math.max(0, failedAttempt - 1),
    policy.retryMaxDelayMs,
  );
}

const sleep = (delayMs) => new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));

export async function checkLink(
  entry,
  policy = REQUEST_POLICY,
  { probe = probeLinkOnce, delay = sleep } = {},
) {
  let attempts = 0;
  let redirects = 0;

  while (attempts < policy.maxAttempts) {
    attempts += 1;
    try {
      const result = await probe(entry, policy);
      redirects += result.redirects;
      if (result.status >= 200 && result.status < 300) {
        const output = {
          id: entry.id,
          url: entry.url,
          outcome: "ok",
          status: result.status,
          attempts,
          redirects,
        };
        const finalUrl = publicFinalUrl(result.finalUrl, entry.url);
        if (finalUrl) output.finalUrl = finalUrl;
        return output;
      }

      const retryable = policy.retryableHttpStatuses.includes(result.status);
      if (!retryable || attempts === policy.maxAttempts) {
        return {
          id: entry.id,
          url: entry.url,
          outcome: "failed",
          status: result.status,
          attempts,
          redirects,
          error: `http-${result.status}`,
        };
      }
    } catch (caught) {
      const error = failureFrom(caught);
      if (!error.retryable || attempts === policy.maxAttempts) {
        const output = {
          id: entry.id,
          url: entry.url,
          outcome: "failed",
          attempts,
          redirects,
          error: error.code,
        };
        if (error.status !== undefined) output.status = error.status;
        return output;
      }
    }

    await delay(retryDelayMs(attempts, policy));
  }

  throw new StableLinkError("unreachable-check-state");
}

export async function checkStableLinks(
  entries,
  policy = REQUEST_POLICY,
  dependencies = {},
) {
  const results = new Array(entries.length);
  let cursor = 0;
  const workerCount = Math.min(policy.concurrency, entries.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= entries.length) return;
        results[index] = await checkLink(entries[index], policy, dependencies);
      }
    }),
  );

  const successful = results.filter((result) => result.outcome === "ok").length;
  return {
    schemaVersion: 1,
    policy: {
      timeoutMs: policy.timeoutMs,
      maxAttempts: policy.maxAttempts,
      maxRedirects: policy.maxRedirects,
      concurrency: policy.concurrency,
      retryBaseDelayMs: policy.retryBaseDelayMs,
      retryMaxDelayMs: policy.retryMaxDelayMs,
      retryableHttpStatuses: [...policy.retryableHttpStatuses],
    },
    registered: results.length,
    successful,
    failed: results.length - successful,
    results,
  };
}

function validatePolicy(policy, errors) {
  if (!valuesEqual(policy, REQUEST_POLICY)) {
    errors.push("requestPolicy must match the reviewed bounded request policy");
  }
}

function validateRegistryEntry(entry, index, errors) {
  const prefix = `links[${index}]`;
  if (!entry || typeof entry !== "object") {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof entry.id !== "string" || !ID_PATTERN.test(entry.id)) {
    errors.push(`${prefix}.id must be lowercase kebab-case`);
  }
  if (!CATEGORIES.has(entry.category)) {
    errors.push(`${prefix}.category is not approved`);
  }
  if (
    !Array.isArray(entry.allowedRedirectHosts) ||
    entry.allowedRedirectHosts.length === 0 ||
    !arraysEqual(entry.allowedRedirectHosts, sortedUnique(entry.allowedRedirectHosts))
  ) {
    errors.push(`${prefix}.allowedRedirectHosts must be a sorted, unique, non-empty array`);
  }

  for (const hostname of entry.allowedRedirectHosts ?? []) {
    if (
      typeof hostname !== "string" ||
      hostname.includes("*") ||
      normalizeHostname(hostname) !== hostname ||
      !APPROVED_HOSTNAME_SET.has(hostname) ||
      isIP(hostname) !== 0
    ) {
      errors.push(`${prefix}.allowedRedirectHosts contains an unapproved hostname`);
    }
  }

  try {
    assertSafeRequestUrl(entry.url, entry.allowedRedirectHosts);
  } catch (caught) {
    errors.push(`${prefix}.url failed policy: ${failureFrom(caught).code}`);
  }
}

export function validateStableLinkConfiguration({
  registry,
  governedDocuments,
  legacyRegistry,
}) {
  const errors = [];
  if (!registry || typeof registry !== "object") {
    return ["stable external link registry must be an object"];
  }
  if (registry.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!arraysEqual(registry.sourceDocuments, GOVERNED_SOURCE_DOCUMENTS)) {
    errors.push("sourceDocuments must match the governed source-document list");
  }
  if (registry.legacySourceRegistry !== LEGACY_SOURCE_REGISTRY) {
    errors.push("legacySourceRegistry must match the governed legacy registry");
  }
  if (registry.excludedLegacyOrigin !== EXCLUDED_LEGACY_ORIGIN) {
    errors.push("excludedLegacyOrigin must match the retired legacy origin");
  }
  validatePolicy(registry.requestPolicy, errors);

  if (!Array.isArray(registry.links) || registry.links.length === 0) {
    errors.push("links must be a non-empty finite array");
    return errors;
  }

  registry.links.forEach((entry, index) => validateRegistryEntry(entry, index, errors));
  const ids = registry.links.map((entry) => entry?.id);
  const urls = registry.links.map((entry) => entry?.url);
  if (!arraysEqual(ids, sortedUnique(ids))) errors.push("links must be sorted by id");
  if (new Set(ids).size !== ids.length) errors.push("link ids must be unique");
  if (new Set(urls).size !== urls.length) errors.push("link URLs must be unique");

  const governedUrls = sortedUnique(
    GOVERNED_SOURCE_DOCUMENTS.flatMap((documentPath) =>
      extractHttpsLinks(governedDocuments?.[documentPath] ?? ""),
    ).filter((value) => {
      try {
        return new URL(value).origin !== EXCLUDED_LEGACY_ORIGIN;
      } catch {
        return true;
      }
    }),
  );
  const registeredUrls = sortedUnique(urls.filter((value) => typeof value === "string"));
  for (const url of governedUrls.filter((value) => !registeredUrls.includes(value))) {
    errors.push(`governed external URL is not registered: ${url}`);
  }
  for (const url of registeredUrls.filter((value) => !governedUrls.includes(value))) {
    errors.push(`registered URL is not present in governed documents: ${url}`);
  }

  const replacements = sortedUnique(
    (legacyRegistry?.sources ?? [])
      .map((source) => source?.stableReplacement)
      .filter((value) => typeof value === "string"),
  );
  for (const url of replacements.filter((value) => !registeredUrls.includes(value))) {
    errors.push(`legacy stable replacement is not registered: ${url}`);
  }

  return errors;
}

export async function loadStableLinkConfiguration(root = process.cwd()) {
  const registryPath = resolve(root, "data/stable-external-links.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const governedDocuments = Object.fromEntries(
    await Promise.all(
      GOVERNED_SOURCE_DOCUMENTS.map(async (documentPath) => [
        documentPath,
        await readFile(resolve(root, documentPath), "utf8"),
      ]),
    ),
  );
  const legacyRegistry = JSON.parse(
    await readFile(resolve(root, LEGACY_SOURCE_REGISTRY), "utf8"),
  );
  const errors = validateStableLinkConfiguration({
    registry,
    governedDocuments,
    legacyRegistry,
  });
  if (errors.length > 0) {
    throw new StableLinkError(`configuration-invalid:${errors.join(" | ")}`);
  }
  return registry;
}
