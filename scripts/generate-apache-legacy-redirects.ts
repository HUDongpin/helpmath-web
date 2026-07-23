import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {legacyRedirects} from '../next.config';

export const LEGACY_TARGET_ORIGIN = 'https://www.helpmath.ai';

export const LEGACY_BLOCKED_PATHS = [
  '/Images/Help_Slideshow.swf',
  '/0214%20Sunburst%20and%20BLI%20Form%20partnership%20for%20HELP%20Math2.pdf',
] as const;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

export const LEGACY_APACHE_OUTPUT_PATHS = [
  path.join(repositoryRoot, 'ops/legacy-host/generated/.htaccess'),
  path.join(repositoryRoot, 'ops/legacy-host/generated/helpmath-legacy-redirects.conf'),
] as const;

export const LEGACY_LOGIN_CONTAINMENT_PATHS = [
  '/student_login.aspx',
  '/teacher_login.aspx',
  '/school_login.aspx',
  '/district_login.aspx',
  '/Project_Admin_Login.aspx',
] as const;

export const LEGACY_LOGIN_CONTAINMENT_OUTPUT_PATHS = [
  path.join(
    repositoryRoot,
    'ops/legacy-host/login-containment/generated/login-containment.prepend.htaccess',
  ),
  path.join(
    repositoryRoot,
    'ops/legacy-host/login-containment/generated/helpmath-login-containment.conf',
  ),
] as const;

export type LegacyRedirectRecord = {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
};

export type ApacheRedirectRule = {
  source: string;
  destination: string;
  pattern: string;
  target: string;
  queryTarget?: string;
  wildcard: boolean;
  operationalOnly: boolean;
  discardQuery: boolean;
  caseInsensitive: boolean;
};

export type ApacheNotFoundRule = {
  source: string;
  pattern: string;
};

export type ApacheLegacyRuleSet = {
  blocked: ApacheNotFoundRule[];
  redirects: ApacheRedirectRule[];
};

export type ApacheLoginContainmentRule = {
  source: (typeof LEGACY_LOGIN_CONTAINMENT_PATHS)[number];
  destination: '/login';
  pattern: string;
  target: string;
};

const wildcardSuffix = '/:path*';

function decodeNextLiteralPath(source: string): string {
  let decoded: string;

  try {
    decoded = decodeURIComponent(source);
  } catch (error) {
    throw new Error(`Legacy redirect source is not valid percent-encoding: ${source}`, {
      cause: error,
    });
  }

  // Next path patterns escape literal grouping characters with a backslash.
  return decoded.replace(/\\([()[\]{}])/g, '$1');
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function legacySourceToApachePattern(source: string): {
  pattern: string;
  wildcard: boolean;
} {
  if (!source.startsWith('/')) {
    throw new Error(`Legacy redirect source must begin with "/": ${source}`);
  }
  if (source.includes('?') || source.includes('#')) {
    throw new Error(`Legacy redirect source cannot contain a query or fragment: ${source}`);
  }

  const wildcard = source.endsWith(wildcardSuffix);
  const literalSource = wildcard ? source.slice(0, -wildcardSuffix.length) : source;

  if (
    literalSource.includes('/:') ||
    literalSource.includes('*') ||
    (!wildcard && source.includes(':'))
  ) {
    throw new Error(`Unsupported Next.js legacy redirect pattern: ${source}`);
  }

  const decoded = decodeNextLiteralPath(literalSource);
  const withoutLeadingSlash = decoded.slice(1);
  const escaped = escapeRegularExpression(withoutLeadingSlash);

  if (source === '/') {
    return {pattern: '^/?$', wildcard: false};
  }

  return {
    pattern: wildcard ? `^/?${escaped}(?:/.*)?$` : `^/?${escaped}$`,
    wildcard,
  };
}

function getReviewedLoginSourceForApachePattern(
  source: string,
): (typeof LEGACY_LOGIN_CONTAINMENT_PATHS)[number] | undefined {
  const candidate = legacySourceToApachePattern(source);
  if (candidate.wildcard) {
    return undefined;
  }
  const candidatePattern = candidate.pattern.toLowerCase();
  return LEGACY_LOGIN_CONTAINMENT_PATHS.find(
    (reviewedSource) =>
      legacySourceToApachePattern(reviewedSource).pattern.toLowerCase() ===
      candidatePattern,
  );
}

function absoluteLegacyTargets(destination: string): {
  target: string;
  queryTarget?: string;
} {
  if (!destination.startsWith('/') || destination.startsWith('//')) {
    throw new Error(`Legacy redirect destination must be an internal absolute path: ${destination}`);
  }
  if (destination.includes('?')) {
    throw new Error(
      `Legacy redirect destination must not replace the incoming query string: ${destination}`,
    );
  }

  const target = new URL(destination, `${LEGACY_TARGET_ORIGIN}/`);
  if (target.origin !== LEGACY_TARGET_ORIGIN) {
    throw new Error(`Legacy redirect escaped the HELP Math target origin: ${destination}`);
  }
  // Apache's rewrite engine does not treat a literal fragment as a URL
  // component while it composes the query. A conditional target puts a
  // non-empty original query before the fragment; the canonical target avoids
  // adding a stray empty '?' when the request had no query.
  return {
    target: target.href,
    ...(target.hash
      ? {queryTarget: `${target.origin}${target.pathname}?%{QUERY_STRING}${target.hash}`}
      : {}),
  };
}

export function buildApacheLoginContainmentRules(
  records: readonly LegacyRedirectRecord[],
): ApacheLoginContainmentRule[] {
  const selectedRecords = new Map<string, LegacyRedirectRecord>();

  for (const record of records) {
    const reviewedSource = getReviewedLoginSourceForApachePattern(record.source);
    if (!reviewedSource) {
      continue;
    }
    if (record.source !== reviewedSource) {
      throw new Error(
        `Legacy login containment source collides after Apache path normalization with ${reviewedSource}: ${record.source}`,
      );
    }
    if (selectedRecords.has(record.source)) {
      throw new Error(`Duplicate legacy login containment source: ${record.source}`);
    }
    selectedRecords.set(record.source, record);
  }

  return LEGACY_LOGIN_CONTAINMENT_PATHS.map((source) => {
    const record = selectedRecords.get(source);
    if (!record) {
      throw new Error(`Missing required legacy login containment source: ${source}`);
    }
    if (
      record.permanent !== true ||
      record.statusCode !== undefined ||
      record.destination !== '/login'
    ) {
      throw new Error(
        `Legacy login containment source must be a permanent /login redirect: ${source}`,
      );
    }

    const {pattern, wildcard} = legacySourceToApachePattern(source);
    if (wildcard) {
      throw new Error(`Legacy login containment source cannot be a wildcard: ${source}`);
    }
    const {target} = absoluteLegacyTargets(record.destination);
    return {
      source,
      destination: '/login',
      pattern,
      target,
    };
  });
}

export function buildApacheLegacyRuleSet(
  records: readonly LegacyRedirectRecord[],
): ApacheLegacyRuleSet {
  const seenSources = new Set<string>();
  const blockedSources = new Set<string>(LEGACY_BLOCKED_PATHS);
  const credentialEntrySources = new Set<string>(LEGACY_LOGIN_CONTAINMENT_PATHS);

  const mappedRules = records.map((record): ApacheRedirectRule => {
    if (record.permanent !== true || record.statusCode !== undefined) {
      throw new Error(`Legacy redirect must use Next.js permanent=true: ${record.source}`);
    }
    if (seenSources.has(record.source)) {
      throw new Error(`Duplicate legacy redirect source: ${record.source}`);
    }
    if (record.source === '/') {
      throw new Error('The Next.js application cannot own the old-host-only root redirect.');
    }
    if (blockedSources.has(record.source)) {
      throw new Error(`Blocked legacy artifact must remain a 404: ${record.source}`);
    }
    seenSources.add(record.source);

    const reviewedCredentialEntry = getReviewedLoginSourceForApachePattern(record.source);
    if (reviewedCredentialEntry && record.source !== reviewedCredentialEntry) {
      throw new Error(
        `Legacy redirect source collides after Apache path normalization with reviewed credential entry ${reviewedCredentialEntry}: ${record.source}`,
      );
    }
    const credentialEntry = credentialEntrySources.has(record.source);
    if (credentialEntry && record.destination !== '/login') {
      throw new Error(
        `Legacy credential-entry redirect must keep the reviewed /login destination: ${record.source}`,
      );
    }

    const {pattern, wildcard} = legacySourceToApachePattern(record.source);
    const targets = absoluteLegacyTargets(record.destination);
    return {
      source: record.source,
      destination: record.destination,
      pattern,
      ...targets,
      wildcard,
      operationalOnly: false,
      discardQuery: credentialEntry,
      caseInsensitive: credentialEntry,
    };
  });

  const exactRules = mappedRules.filter((rule) => !rule.wildcard);
  const wildcardRules = mappedRules.filter((rule) => rule.wildcard);
  const rootPattern = legacySourceToApachePattern('/').pattern;

  return {
    blocked: LEGACY_BLOCKED_PATHS.map((source) => ({
      source,
      pattern: legacySourceToApachePattern(source).pattern,
    })),
    redirects: [
      {
        source: '/',
        destination: '/',
        pattern: rootPattern,
        target: `${LEGACY_TARGET_ORIGIN}/`,
        wildcard: false,
        operationalOnly: true,
        discardQuery: false,
        caseInsensitive: false,
      },
      ...exactRules,
      ...wildcardRules,
    ],
  };
}

function apacheQuoted(value: string): string {
  if (value.includes('"') || value.includes('\n') || value.includes('\r')) {
    throw new Error(`Apache rule value cannot be quoted safely: ${value}`);
  }
  return `"${value}"`;
}

export function renderApacheLegacyRules(ruleSet: ApacheLegacyRuleSet): string {
  const lines = [
    '# GENERATED FILE. DO NOT EDIT.',
    '# Source of redirect truth: next.config.ts legacyRedirects.',
    '# Regenerate with: npm run generate:legacy-apache',
    '# Use as the legacy DocumentRoot .htaccess or include inside its <Directory> block.',
    '',
    'ErrorDocument 404 "Not Found"',
    'RewriteEngine On',
    '',
    '# Never expose retired binary or unverified partnership artifacts.',
  ];

  for (const rule of ruleSet.blocked) {
    lines.push(
      `# 404 ${rule.source}`,
      `RewriteRule ${apacheQuoted(rule.pattern)} "-" [R=404,L]`,
    );
  }

  lines.push('', '# Permanent one-hop redirects. Exact paths precede directory wildcards.');
  for (const rule of ruleSet.redirects) {
    const qualifier = rule.operationalOnly ? ' (old-host root)' : '';
    if (rule.discardQuery !== rule.caseInsensitive) {
      throw new Error(
        `Legacy credential-entry privacy flags must be enabled together: ${rule.source}`,
      );
    }
    const flags =
      rule.discardQuery && rule.caseInsensitive
        ? '[R=301,L,NE,QSD,NC]'
        : '[R=301,L,NE]';
    if (rule.queryTarget && rule.discardQuery) {
      throw new Error(
        `Legacy redirect cannot both preserve and discard a query string: ${rule.source}`,
      );
    }
    lines.push(`# ${rule.source} -> ${rule.destination}${qualifier}`);
    if (rule.queryTarget) {
      lines.push(
        'RewriteCond "%{QUERY_STRING}" "!^$"',
        `RewriteRule ${apacheQuoted(rule.pattern)} ${apacheQuoted(rule.queryTarget)} ${flags}`,
      );
    }
    lines.push(
      `RewriteRule ${apacheQuoted(rule.pattern)} ${apacheQuoted(rule.target)} ${flags}`,
    );
  }

  lines.push(
    '',
    '# Fail closed: no unlisted legacy path or residual file is publicly served.',
    'RewriteRule "^" "-" [R=404,L]',
    '',
  );

  return lines.join('\n');
}

export function renderApacheLoginContainmentRules(
  rules: readonly ApacheLoginContainmentRule[],
): string {
  if (rules.length !== LEGACY_LOGIN_CONTAINMENT_PATHS.length) {
    throw new Error(
      `Legacy login containment requires exactly ${LEGACY_LOGIN_CONTAINMENT_PATHS.length} rules.`,
    );
  }

  const lines = [
    '# GENERATED FILE. DO NOT EDIT.',
    '# Emergency containment source: next.config.ts legacyRedirects.',
    '# Regenerate with: npm run generate:legacy-apache',
    '# Deploy only through ops/legacy-host/login-containment/README.md.',
    '# This block intentionally has no root redirect, catch-all, ErrorDocument, or file rule.',
    '',
    'RewriteEngine On',
    '',
    '# Stop retired credential-entry pages without retiring any other legacy route.',
    '# QSD discards all incoming query data; NC covers case variants of the retired paths.',
  ];

  for (const [index, rule] of rules.entries()) {
    const expectedSource = LEGACY_LOGIN_CONTAINMENT_PATHS[index];
    const expectedPattern = legacySourceToApachePattern(expectedSource).pattern;
    if (
      rule.source !== expectedSource ||
      rule.destination !== '/login' ||
      rule.pattern !== expectedPattern ||
      rule.target !== `${LEGACY_TARGET_ORIGIN}/login`
    ) {
      throw new Error(
        `Legacy login containment rule does not match the reviewed exact mapping: ${expectedSource}`,
      );
    }
    lines.push(
      `# ${rule.source} -> ${rule.destination}`,
      `RewriteRule ${apacheQuoted(rule.pattern)} ${apacheQuoted(rule.target)} [R=301,L,NE,QSD,NC]`,
    );
  }

  lines.push(
    '',
    '# End emergency containment. Unmatched legacy requests continue to the existing host.',
    '',
  );
  return lines.join('\n');
}

export async function getExpectedApacheLegacyRules(): Promise<string> {
  const records = (await legacyRedirects()) as LegacyRedirectRecord[];
  return renderApacheLegacyRules(buildApacheLegacyRuleSet(records));
}

export async function getExpectedApacheLoginContainmentRules(): Promise<string> {
  const records = (await legacyRedirects()) as LegacyRedirectRecord[];
  return renderApacheLoginContainmentRules(buildApacheLoginContainmentRules(records));
}

async function generateOutputs(checkOnly: boolean): Promise<void> {
  const expectedOutputs = [
    {
      paths: LEGACY_APACHE_OUTPUT_PATHS,
      expected: await getExpectedApacheLegacyRules(),
    },
    {
      paths: LEGACY_LOGIN_CONTAINMENT_OUTPUT_PATHS,
      expected: await getExpectedApacheLoginContainmentRules(),
    },
  ] as const;
  const staleOutputs: string[] = [];

  for (const outputGroup of expectedOutputs) {
    for (const outputPath of outputGroup.paths) {
      if (checkOnly) {
        let actual: string | undefined;
        try {
          actual = await readFile(outputPath, 'utf8');
        } catch {
          actual = undefined;
        }
        if (actual !== outputGroup.expected) {
          staleOutputs.push(path.relative(repositoryRoot, outputPath));
        }
        continue;
      }

      await mkdir(path.dirname(outputPath), {recursive: true});
      await writeFile(outputPath, outputGroup.expected, 'utf8');
    }
  }

  if (staleOutputs.length > 0) {
    throw new Error(
      `Generated Apache legacy rules are missing or stale: ${staleOutputs.join(', ')}. ` +
        'Run npm run generate:legacy-apache.',
    );
  }

  const verb = checkOnly ? 'Verified' : 'Generated';
  const outputCount = expectedOutputs.reduce((count, group) => count + group.paths.length, 0);
  console.log(
    `${verb} ${outputCount} Apache legacy-host artifacts from next.config.ts.`,
  );
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => argument !== '--check') || arguments_.length > 1) {
    throw new Error('Usage: tsx scripts/generate-apache-legacy-redirects.ts [--check]');
  }
  await generateOutputs(arguments_[0] === '--check');
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (entryPoint === import.meta.url) {
  await main();
}
