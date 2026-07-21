import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {describe, it} from 'node:test';

const evidencePath = 'docs/evidence/vercel-production-alias-2026-07-21.json';
const expectedSha256 = '990d6c47d053f32ca4e37803832297c8e081a11e1e34bfce982862d38c876828';

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
