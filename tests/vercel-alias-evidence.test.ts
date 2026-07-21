import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {describe, it} from 'node:test';

const evidencePath = 'docs/evidence/vercel-production-alias-2026-07-21.json';
const expectedSha256 = '990d6c47d053f32ca4e37803832297c8e081a11e1e34bfce982862d38c876828';
const currentEvidencePath = 'docs/evidence/vercel-production-alias-2026-07-22.json';
const currentExpectedSha256 = 'a60271a276b4301d1877761e455b92a93afc851fe9079a3f207b23645f8eb0f0';
const pr15EvidencePath = 'docs/evidence/vercel-production-alias-pr15-2026-07-22.json';
const pr15ExpectedSha256 = 'a1650827c4a08ecb8d577f2f385126a0d66395674d9616f34528f12afda18cd3';

type AliasEvidence = {
  schemaVersion: number;
  recordedAt: string;
  source: {
    method: string;
    cliVersion: string;
    rawOutputRetained: boolean;
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
  checks: Record<string, boolean>;
  limitations: string[];
};

describe('authenticated Vercel production alias evidence', () => {
  it('pins the exact production deployment, commit, aliases, and reduced evidence hash', async () => {
    const bytes = await readFile(evidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as AliasEvidence;

    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedSha256);
    assert.equal(evidence.schemaVersion, 1);
    assert.match(evidence.recordedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    assert.match(evidence.source.method, /Authenticated Vercel CLI/iu);
    assert.equal(evidence.source.cliVersion, '56.4.1');
    assert.equal(evidence.source.rawOutputRetained, false);
    assert.match(evidence.deployment.vercelDeploymentId, /^dpl_[A-Za-z0-9]+$/u);
    assert.ok(Number.isSafeInteger(evidence.deployment.githubDeploymentId));
    assert.match(evidence.deployment.repositoryCommit, /^[0-9a-f]{40}$/u);
    assert.equal(evidence.deployment.target, 'production');
    assert.equal(evidence.deployment.readyState, 'READY');
    assert.match(
      evidence.deployment.immutableUrl,
      /^https:\/\/helpmath-[a-z0-9]+-peter-dongpin-hu-s-projects\.vercel\.app$/u,
    );
    assert.deepEqual(evidence.aliases.slice(0, 2), [
      'https://www.helpmath.ai',
      'https://helpmath.ai',
    ]);
    assert.equal(new Set(evidence.aliases).size, evidence.aliases.length);
    assert.ok(Object.values(evidence.checks).every(Boolean));
    assert.ok(evidence.limitations.some((value) => /not a registrar or DNS-provider zone export/iu.test(value)));
  });

  it('contains no credential-shaped field names or values', async () => {
    const serialized = await readFile(evidencePath, 'utf8');

    assert.doesNotMatch(serialized, /"(?:token|secret|password|passphrase|cookie|privateKey)"\s*:/iu);
    assert.doesNotMatch(serialized, /(?:Bearer\s+|gh[opsu]_[A-Za-z0-9]+|vercel_[A-Za-z0-9]+)/u);
  });
});

describe('historical PR #13 Vercel production alias evidence', () => {
  it('pins the current deployment, repository lineage, aliases, and corroborating runs', async () => {
    const bytes = await readFile(currentEvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as AliasEvidence & {
      deployment: AliasEvidence['deployment'] & {
        currentInspectGitSourceStatus: string;
      };
      corroboratingEvidence: Record<string, string>;
    };

    assert.equal(createHash('sha256').update(bytes).digest('hex'), currentExpectedSha256);
    assert.equal(evidence.schemaVersion, 1);
    assert.equal(evidence.source.cliVersion, '56.4.1');
    assert.equal(evidence.source.rawOutputRetained, false);
    assert.equal(evidence.deployment.vercelDeploymentId, 'dpl_2CCekiWMGdnwc78gdifVSs1NWNsX');
    assert.equal(evidence.deployment.githubDeploymentId, 5543929832);
    assert.equal(
      evidence.deployment.repositoryCommit,
      '05c3b460db78ac61b88b6d34479d925af634d724',
    );
    assert.equal(evidence.deployment.target, 'production');
    assert.equal(evidence.deployment.readyState, 'READY');
    assert.equal(
      evidence.deployment.immutableUrl,
      'https://helpmath-3uwemp4ov-peter-dongpin-hu-s-projects.vercel.app',
    );
    assert.equal(
      evidence.deployment.currentInspectGitSourceStatus,
      'not-exposed-by-retained-inspect-fields',
    );
    assert.deepEqual(evidence.aliases.slice(0, 2), [
      'https://www.helpmath.ai',
      'https://helpmath.ai',
    ]);
    assert.ok(Object.values(evidence.checks).every(Boolean));
    assert.match(evidence.corroboratingEvidence.productionQualityRun, /29858878638$/u);
    assert.match(evidence.corroboratingEvidence.productionSmokeRun, /29859546466$/u);
    assert.match(evidence.corroboratingEvidence.stableExternalLinkRun, /29860501241$/u);
    assert.ok(evidence.limitations.some((value) => /did not expose a Git source/iu.test(value)));
    assert.ok(evidence.limitations.some((value) => /not a registrar or DNS-provider zone export/iu.test(value)));
  });

  it('contains no credential-shaped field names or values', async () => {
    const serialized = await readFile(currentEvidencePath, 'utf8');

    assert.doesNotMatch(serialized, /"(?:token|secret|password|passphrase|cookie|privateKey)"\s*:/iu);
    assert.doesNotMatch(serialized, /(?:Bearer\s+|gh[opsu]_[A-Za-z0-9]+|vercel_[A-Za-z0-9]+)/u);
  });
});

describe('current PR #15 Vercel production alias evidence', () => {
  it('pins the exact deployment, immutable URL, formal aliases, and same-commit runs', async () => {
    const bytes = await readFile(pr15EvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as AliasEvidence & {
      deployment: AliasEvidence['deployment'] & {
        currentInspectGitSourceStatus: string;
      };
      corroboratingEvidence: Record<string, string>;
    };

    assert.equal(createHash('sha256').update(bytes).digest('hex'), pr15ExpectedSha256);
    assert.equal(evidence.schemaVersion, 1);
    assert.equal(evidence.source.cliVersion, '56.4.1');
    assert.equal(evidence.source.rawOutputRetained, false);
    assert.equal(evidence.deployment.vercelDeploymentId, 'dpl_GAwLFodMFiqAE7RDibwp77mgwjUQ');
    assert.equal(evidence.deployment.githubDeploymentId, 5544827753);
    assert.equal(
      evidence.deployment.repositoryCommit,
      'd3b84e8dcf539d8859641bdb58cbaa5237efc461',
    );
    assert.equal(evidence.deployment.target, 'production');
    assert.equal(evidence.deployment.readyState, 'READY');
    assert.equal(evidence.deployment.createdAt, '2026-07-21T19:56:43.210Z');
    assert.equal(
      evidence.deployment.immutableUrl,
      'https://helpmath-peh16hg5x-peter-dongpin-hu-s-projects.vercel.app',
    );
    assert.equal(
      evidence.deployment.currentInspectGitSourceStatus,
      'field-not-exposed-by-cli-json',
    );
    assert.deepEqual(evidence.aliases, [
      'https://www.helpmath.ai',
      'https://helpmath.ai',
      'https://helpmath-web.vercel.app',
      'https://helpmath-web-peter-dongpin-hu-s-projects.vercel.app',
      'https://helpmath-web-git-main-peter-dongpin-hu-s-projects.vercel.app',
    ]);
    assert.equal(new Set(evidence.aliases).size, evidence.aliases.length);
    assert.ok(Object.values(evidence.checks).every(Boolean));
    assert.match(evidence.corroboratingEvidence.productionQualityRun, /29863649827$/u);
    assert.match(evidence.corroboratingEvidence.productionSmokeRun, /29863684054$/u);
    assert.match(evidence.corroboratingEvidence.stableExternalLinkRun, /29863927541$/u);
    assert.ok(evidence.limitations.some((value) => /did not expose a gitSource field/iu.test(value)));
    assert.ok(evidence.limitations.some((value) => /not a registrar or DNS-provider zone export/iu.test(value)));
  });

  it('contains no credential-shaped field names or values', async () => {
    const serialized = await readFile(pr15EvidencePath, 'utf8');

    assert.doesNotMatch(serialized, /"(?:token|secret|password|passphrase|cookie|privateKey)"\s*:/iu);
    assert.doesNotMatch(serialized, /(?:Bearer\s+|gh[opsu]_[A-Za-z0-9]+|vercel_[A-Za-z0-9]+)/u);
  });
});
