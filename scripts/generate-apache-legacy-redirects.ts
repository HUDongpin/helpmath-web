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
};

export type ApacheNotFoundRule = {
  source: string;
  pattern: string;
};

export type ApacheLegacyRuleSet = {
  blocked: ApacheNotFoundRule[];
  redirects: ApacheRedirectRule[];
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

export function buildApacheLegacyRuleSet(
  records: readonly LegacyRedirectRecord[],
): ApacheLegacyRuleSet {
  const seenSources = new Set<string>();
  const blockedSources = new Set<string>(LEGACY_BLOCKED_PATHS);

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

    const {pattern, wildcard} = legacySourceToApachePattern(record.source);
    const targets = absoluteLegacyTargets(record.destination);
    return {
      source: record.source,
      destination: record.destination,
      pattern,
      ...targets,
      wildcard,
      operationalOnly: false,
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
    lines.push(`# ${rule.source} -> ${rule.destination}${qualifier}`);
    if (rule.queryTarget) {
      lines.push(
        'RewriteCond "%{QUERY_STRING}" "!^$"',
        `RewriteRule ${apacheQuoted(rule.pattern)} ${apacheQuoted(rule.queryTarget)} [R=301,L,NE]`,
      );
    }
    lines.push(
      `RewriteRule ${apacheQuoted(rule.pattern)} ${apacheQuoted(rule.target)} [R=301,L,NE]`,
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

export async function getExpectedApacheLegacyRules(): Promise<string> {
  const records = (await legacyRedirects()) as LegacyRedirectRecord[];
  return renderApacheLegacyRules(buildApacheLegacyRuleSet(records));
}

async function generateOutputs(checkOnly: boolean): Promise<void> {
  const expected = await getExpectedApacheLegacyRules();
  const staleOutputs: string[] = [];

  for (const outputPath of LEGACY_APACHE_OUTPUT_PATHS) {
    if (checkOnly) {
      let actual: string | undefined;
      try {
        actual = await readFile(outputPath, 'utf8');
      } catch {
        actual = undefined;
      }
      if (actual !== expected) {
        staleOutputs.push(path.relative(repositoryRoot, outputPath));
      }
      continue;
    }

    await mkdir(path.dirname(outputPath), {recursive: true});
    await writeFile(outputPath, expected, 'utf8');
  }

  if (staleOutputs.length > 0) {
    throw new Error(
      `Generated Apache legacy rules are missing or stale: ${staleOutputs.join(', ')}. ` +
        'Run npm run generate:legacy-apache.',
    );
  }

  const verb = checkOnly ? 'Verified' : 'Generated';
  console.log(
    `${verb} ${LEGACY_APACHE_OUTPUT_PATHS.length} Apache legacy-host artifacts from next.config.ts.`,
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
