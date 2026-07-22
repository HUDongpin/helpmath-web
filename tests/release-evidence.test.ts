import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();
const releaseDirectory = path.join(repositoryRoot, 'docs/releases');
const evidenceDirectory = path.join(repositoryRoot, 'docs/evidence');
const releaseNamePattern = /^(\d{4}-\d{2}-\d{2})-pr(\d+)\.md$/u;
const aliasEvidenceNamePattern =
  /^vercel-production-alias-(\d{4}-\d{2}-\d{2})(?:-pr(\d+))?\.json$/u;

type ReleaseRecord = {
  date: string;
  filename: string;
  pullRequest: number;
};

type AliasEvidence = {
  schemaVersion: number;
  recordedAt: string;
  source: {
    method: string;
    cliVersion: string;
    rawOutputRetained: boolean;
  };
  project: {
    name: string;
  };
  deployment: {
    vercelDeploymentId: string;
    githubDeploymentId: number;
    repositoryCommit: string;
    target: string;
    readyState: string;
    createdAt: string;
    immutableUrl: string;
  };
  aliases: string[];
  corroboratingEvidence: {
    executivePreviewLifecycleRun?: string;
    productionQualityRun?: string;
    productionSmokeRun?: string;
  };
  checks: Record<string, boolean>;
  limitations: string[];
};

type AliasReference = {
  relativePath: string;
  sha256: string;
};

function tableValue(record: string, field: string): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = record.match(new RegExp(`^\\| ${escaped} \\| (.+) \\|$`, 'mu'));
  assert.ok(match, `${field} is missing`);
  return match[1];
}

function aliasReference(record: string): AliasReference {
  const assignment = tableValue(record, 'Canonical alias assignment');
  const match = assignment.match(
    /`(docs\/evidence\/vercel-production-alias-\d{4}-\d{2}-\d{2}(?:-pr\d+)?\.json)`, SHA-256 `([0-9a-f]{64})`/u,
  );
  assert.ok(match, 'Canonical alias assignment has no evidence path and SHA-256.');
  return {relativePath: match[1], sha256: match[2]};
}

function requiredMatch(value: string, pattern: RegExp, label: string): RegExpMatchArray {
  const match = value.match(pattern);
  assert.ok(match, `${label} is missing`);
  return match;
}

async function releaseRecords(): Promise<ReleaseRecord[]> {
  return (await readdir(releaseDirectory))
    .flatMap((filename) => {
      const match = filename.match(releaseNamePattern);
      if (!match) return [];
      return [{date: match[1], filename, pullRequest: Number(match[2])}];
    })
    .sort((left, right) =>
      left.date.localeCompare(right.date) || left.pullRequest - right.pullRequest,
    );
}

describe('release evidence records', () => {
  it('keeps the latest immutable record as both operational baselines', async () => {
    const records = await releaseRecords();
    assert.ok(records.length > 0, 'No dated release records were found.');
    const latest = records.at(-1);
    assert.ok(latest);
    const reference = `docs/releases/${latest.filename}`;
    const [record, launchDecisions, legacyCutover] = await Promise.all([
      readFile(path.join(releaseDirectory, latest.filename), 'utf8'),
      readFile(path.join(repositoryRoot, 'docs/LAUNCH_DECISIONS.md'), 'utf8'),
      readFile(path.join(repositoryRoot, 'docs/LEGACY_CUTOVER.md'), 'utf8'),
    ]);

    const productionCommit = tableValue(record, 'Production commit').replaceAll('`', '');
    const production = tableValue(record, 'Production');
    const githubDeploymentId = requiredMatch(
      production,
      /GitHub deployment `(\d+)`/u,
      'Production GitHub deployment',
    )[1];
    const vercelDeploymentLocator = requiredMatch(
      production,
      /vercel\.com\/peter-dongpin-hu-s-projects\/helpmath-web\/([A-Za-z0-9]+)/u,
      'Production Vercel deployment',
    )[1];
    const productionQualityRun = requiredMatch(
      tableValue(record, 'Production Quality run'),
      /actions\/runs\/(\d+)/u,
      'Production Quality run',
    )[1];
    const productionSmokeRun = requiredMatch(
      record,
      /Automated production-smoke run\s+\[\d+\]\(https:\/\/github\.com\/HUDongpin\/helpmath-web\/actions\/runs\/(\d+)\)/u,
      'Production smoke run',
    )[1];
    const executivePreviewLifecycleRun = record.match(
      /Automated executive-preview lifecycle run\s+\[\d+\]\(https:\/\/github\.com\/HUDongpin\/helpmath-web\/actions\/runs\/(\d+)\)/u,
    )?.[1];
    const aliasEvidence = aliasReference(record).relativePath;

    const launchBaseline = tableValue(
      launchDecisions,
      'Most recent application release baseline (historical evidence gaps disclosed)',
    );
    const cutoverBaseline = tableValue(
      legacyCutover,
      'Release commit and Vercel deployment evidence',
    );

    for (const [label, baseline] of [
      ['launch-decision', launchBaseline],
      ['legacy-cutover', cutoverBaseline],
    ] as const) {
      for (const expected of [
        reference,
        productionCommit,
        githubDeploymentId,
        vercelDeploymentLocator,
        productionQualityRun,
        productionSmokeRun,
        aliasEvidence,
      ]) {
        assert.ok(baseline.includes(expected), `${label} baseline is missing ${expected}`);
      }
    }
    if (executivePreviewLifecycleRun) {
      assert.ok(
        launchBaseline.includes(executivePreviewLifecycleRun),
        `launch-decision baseline is missing ${executivePreviewLifecycleRun}`,
      );
    }
  });

  it('retains the required identity, smoke, boundary, and exception fields', async () => {
    const records = await releaseRecords();
    const latest = records.at(-1);
    assert.ok(latest);
    const record = await readFile(path.join(releaseDirectory, latest.filename), 'utf8');

    const candidateCommit = tableValue(record, 'Candidate commit');
    const productionCommit = tableValue(record, 'Production commit');
    assert.match(candidateCommit, /^`[0-9a-f]{40}`$/u);
    assert.match(productionCommit, /^`[0-9a-f]{40}`$/u);
    assert.notEqual(candidateCommit, productionCommit);

    const pullRequest = tableValue(record, 'Pull request');
    assert.match(pullRequest, /https:\/\/github\.com\/HUDongpin\/helpmath-web\/pull\/\d+/u);
    assert.match(pullRequest, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/u);

    for (const field of ['Candidate Quality run', 'Production Quality run']) {
      const quality = tableValue(record, field);
      assert.match(quality, /https:\/\/github\.com\/HUDongpin\/helpmath-web\/actions\/runs\/\d+/u);
      assert.match(quality, /`success`/u);
      assert.match(quality, /matching the (?:candidate|production) commit/u);
    }

    for (const field of ['Protected Preview', 'Production']) {
      const deployment = tableValue(record, field);
      assert.match(deployment, /GitHub deployment `\d+`/u);
      assert.match(
        deployment,
        /https:\/\/vercel\.com\/peter-dongpin-hu-s-projects\/helpmath-web\/[A-Za-z0-9]+/u,
      );
      assert.match(deployment, /`success`/u);
      assert.match(deployment, /matching the (?:candidate|production) commit/u);
      assert.match(deployment, /https:\/\/[a-z0-9-]+\.vercel\.app/u);
    }

    const aliasAssignment = tableValue(record, 'Canonical alias assignment');
    assert.match(aliasAssignment, /Owner-authenticated Vercel CLI/iu);
    assert.match(aliasAssignment, /`READY` Production deployment/iu);
    assert.match(aliasAssignment, /https:\/\/www\.helpmath\.ai/u);
    assert.match(aliasAssignment, /https:\/\/helpmath\.ai/u);
    assert.match(aliasAssignment, /docs\/evidence\/vercel-production-alias-\d{4}-\d{2}-\d{2}(?:-pr\d+)?\.json/u);
    assert.match(aliasAssignment, /SHA-256 `[0-9a-f]{64}`/u);

    assert.match(tableValue(record, 'Contact mode'), /^Disabled;/u);
    const smokeBlocks = [...record.matchAll(/```json\n([\s\S]*?)\n```/gu)].map(
      (match) =>
        JSON.parse(match[1]) as {
          baseUrl?: string;
          failures?: unknown[];
        },
    );
    assert.ok(
      smokeBlocks.some(
        (smoke) =>
          smoke.baseUrl === 'https://www.helpmath.ai' &&
          Array.isArray(smoke.failures) &&
          smoke.failures.length === 0,
      ),
      'No valid zero-failure smoke JSON was retained.',
    );
    const lifecycleBlocks = [...record.matchAll(/```json\n([\s\S]*?)\n```/gu)].map(
      (match) =>
        JSON.parse(match[1]) as {
          expiresAt?: string;
          failures?: unknown[];
          maximumExpiresAt?: string;
          phase?: string;
          state?: string;
        },
    );
    if (/Automated executive-preview lifecycle run/iu.test(record)) {
      assert.ok(
        lifecycleBlocks.some(
          (lifecycle) =>
            lifecycle.phase === 'review-window' &&
            lifecycle.state === 'login' &&
            lifecycle.expiresAt === lifecycle.maximumExpiresAt &&
            Array.isArray(lifecycle.failures) &&
            lifecycle.failures.length === 0,
        ),
        'No valid zero-failure Executive Preview lifecycle JSON was retained.',
      );
    }
    assert.match(record, /^## Exceptions and follow-up gates$/mu);
    assert.match(record, /^## Alias-assignment evidence$/mu);
    assert.match(record, /semantic smoke behind the protected PR #\d+ Preview was not retained/iu);
    assert.match(record, /did not request executive authentication/iu);
    assert.match(record, /off-device custody/iu);
    assert.match(record, /not authorization|not authoriz(?:e|ation)/iu);
  });

  it('binds retained alias evidence to release identity and keeps the newest record current', async () => {
    const records = await releaseRecords();
    const latest = records.at(-1);
    assert.ok(latest);

    const releaseContents = await Promise.all(
      records.map(async (record) => ({
        ...record,
        contents: await readFile(path.join(releaseDirectory, record.filename), 'utf8'),
      })),
    );
    const releasesWithAliases = releaseContents.filter(({contents}) =>
      contents.includes('| Canonical alias assignment |'),
    );
    const references = await Promise.all(
      releasesWithAliases.map(async ({contents}) => {
        const reference = aliasReference(contents);
        const absolutePath = path.join(repositoryRoot, reference.relativePath);
        assert.equal(
          path.dirname(absolutePath),
          evidenceDirectory,
          'Alias evidence must remain directly inside docs/evidence.',
        );
        const bytes = await readFile(absolutePath);
        assert.equal(
          createHash('sha256').update(bytes).digest('hex'),
          reference.sha256,
          `${reference.relativePath} does not match its retained SHA-256.`,
        );
        return reference;
      }),
    );

    const evidenceFiles = (await readdir(evidenceDirectory))
      .filter((filename) => aliasEvidenceNamePattern.test(filename))
      .sort((left, right) => {
        const leftMatch = requiredMatch(left, aliasEvidenceNamePattern, 'Alias evidence filename');
        const rightMatch = requiredMatch(right, aliasEvidenceNamePattern, 'Alias evidence filename');
        return leftMatch[1].localeCompare(rightMatch[1]) ||
          Number(leftMatch[2] ?? 0) - Number(rightMatch[2] ?? 0);
      });
    assert.deepEqual(
      [...new Set(references.map(({relativePath}) => path.basename(relativePath)))].sort(),
      [...evidenceFiles].sort(),
      'Every retained alias observation must be referenced by an immutable release record.',
    );

    const latestRecord = releaseContents.find(({filename}) => filename === latest.filename);
    assert.ok(latestRecord);
    const latestReference = aliasReference(latestRecord.contents);
    assert.equal(
      path.basename(latestReference.relativePath),
      evidenceFiles.at(-1),
      'The newest release must reference the newest alias observation.',
    );
    const latestAliasMatch = requiredMatch(
      path.basename(latestReference.relativePath),
      aliasEvidenceNamePattern,
      'Alias evidence date',
    );
    assert.equal(
      latestAliasMatch[1],
      latest.date,
      'The newest release and alias observation must use the same record date.',
    );
    if (latestAliasMatch[2]) {
      assert.equal(
        Number(latestAliasMatch[2]),
        latest.pullRequest,
        'A PR-suffixed alias observation must match its release record.',
      );
    }

    const evidence = JSON.parse(
      await readFile(path.join(repositoryRoot, latestReference.relativePath), 'utf8'),
    ) as AliasEvidence;
    const productionCommit = tableValue(latestRecord.contents, 'Production commit').replaceAll(
      '`',
      '',
    );
    const production = tableValue(latestRecord.contents, 'Production');
    const assignment = tableValue(latestRecord.contents, 'Canonical alias assignment');
    const githubDeploymentId = Number(
      requiredMatch(production, /GitHub deployment `(\d+)`/u, 'Production GitHub deployment')[1],
    );
    const vercelDeploymentLocator = requiredMatch(
      production,
      /vercel\.com\/peter-dongpin-hu-s-projects\/helpmath-web\/([A-Za-z0-9]+)/u,
      'Production Vercel deployment',
    )[1];
    const immutableUrl = requiredMatch(
      production,
      /(https:\/\/[a-z0-9-]+\.vercel\.app)/u,
      'Production immutable URL',
    )[1];
    const qualityRunUrl = requiredMatch(
      tableValue(latestRecord.contents, 'Production Quality run'),
      /(https:\/\/github\.com\/HUDongpin\/helpmath-web\/actions\/runs\/\d+)/u,
      'Production Quality URL',
    )[1];
    const smokeRunUrl = requiredMatch(
      latestRecord.contents,
      /Automated production-smoke run\s+\[\d+\]\((https:\/\/github\.com\/HUDongpin\/helpmath-web\/actions\/runs\/\d+)\)/u,
      'Production smoke URL',
    )[1];
    const executivePreviewLifecycleRunUrl = latestRecord.contents.match(
      /Automated executive-preview lifecycle run\s+\[\d+\]\((https:\/\/github\.com\/HUDongpin\/helpmath-web\/actions\/runs\/\d+)\)/u,
    )?.[1];

    assert.equal(evidence.schemaVersion, 1);
    assert.match(evidence.recordedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    assert.match(evidence.source.method, /Authenticated Vercel CLI inspect/iu);
    assert.equal(evidence.source.rawOutputRetained, false);
    assert.equal(evidence.project.name, 'helpmath-web');
    assert.equal(evidence.deployment.repositoryCommit, productionCommit);
    assert.equal(evidence.deployment.githubDeploymentId, githubDeploymentId);
    assert.equal(evidence.deployment.vercelDeploymentId, `dpl_${vercelDeploymentLocator}`);
    assert.equal(evidence.deployment.immutableUrl, immutableUrl);
    assert.equal(evidence.deployment.target, 'production');
    assert.equal(evidence.deployment.readyState, 'READY');
    assert.match(evidence.deployment.createdAt, /^\d{4}-\d{2}-\d{2}T/u);
    assert.equal(evidence.corroboratingEvidence.productionQualityRun, qualityRunUrl);
    assert.equal(evidence.corroboratingEvidence.productionSmokeRun, smokeRunUrl);
    if (executivePreviewLifecycleRunUrl) {
      assert.equal(
        evidence.corroboratingEvidence.executivePreviewLifecycleRun,
        executivePreviewLifecycleRunUrl,
      );
    }
    assert.ok(evidence.aliases.includes('https://www.helpmath.ai'));
    assert.ok(evidence.aliases.includes('https://helpmath.ai'));
    assert.ok(Object.values(evidence.checks).length > 0);
    assert.ok(Object.values(evidence.checks).every((check) => check));
    assert.ok(evidence.limitations.some((limitation) => /does not authorize/iu.test(limitation)));
    assert.ok(assignment.includes(`CLI \`${evidence.source.cliVersion}\``));
    assert.ok(assignment.includes(`\`${evidence.deployment.readyState}\` Production deployment`));
    assert.ok(assignment.includes(`\`${evidence.deployment.vercelDeploymentId}\``));
  });
});
