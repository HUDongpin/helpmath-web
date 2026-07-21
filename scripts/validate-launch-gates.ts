import {access, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

import {LAUNCH_GATE_IDS} from '../lib/launch-gate-ids';
import {validateLaunchGateManifest} from '../lib/launch-gate-validation';
import {isLegalCopyDraft, isLegalCopyReady} from '../lib/legal-copy-readiness';

const repositoryRoot = process.cwd();
const manifestPath = path.join(repositoryRoot, 'config/launch-gates.json');
const snapshotPath = path.join(repositoryRoot, 'demos/SNAPSHOT.json');

const manifestText = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(manifestText) as {
  gates?: Record<string, {
    status?: string;
    evidenceRefs?: string[];
    blockerRefs?: string[];
  }>;
};
const errors = validateLaunchGateManifest(manifest);

if (manifest.gates?.legalPublication?.status === 'holding' && !isLegalCopyDraft()) {
  errors.push('legalPublication is holding but both localized legal notices are not marked draft');
}
if (manifest.gates?.legalPublication?.status === 'approved' && !isLegalCopyReady()) {
  errors.push('legalPublication is approved while English or Spanish legal copy remains draft');
}

if (
  process.env.NEXT_PUBLIC_CONTACT_ENABLED === 'true' &&
  !(
    manifest.gates?.legalPublication?.status === 'approved' &&
    manifest.gates?.contactIntake?.status === 'approved'
  )
) {
  errors.push(
    'NEXT_PUBLIC_CONTACT_ENABLED=true is forbidden until legalPublication and contactIntake are approved',
  );
}

for (const [gateId, gate] of Object.entries(manifest.gates ?? {})) {
  for (const reference of [...(gate.evidenceRefs ?? []), ...(gate.blockerRefs ?? [])]) {
    const resolved = path.resolve(repositoryRoot, reference);
    if (!resolved.startsWith(`${repositoryRoot}${path.sep}`)) {
      errors.push(`gates.${gateId} reference escapes the repository: ${reference}`);
      continue;
    }
    await access(resolved).catch(() => {
      errors.push(`gates.${gateId} reference does not exist: ${reference}`);
    });
  }
}

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as {
  sources?: Record<string, {
    public?: boolean;
    publication?: {access?: string; indexable?: boolean};
  }>;
};
if (manifest.gates?.demoPublication?.status !== 'approved') {
  for (const [id, source] of Object.entries(snapshot.sources ?? {})) {
    if (
      source.public === true ||
      source.publication?.access !== 'private' ||
      source.publication?.indexable === true
    ) {
      errors.push(`${id} is public or indexable while demoPublication is not approved`);
    }
  }
}

const result = {
  manifest: path.relative(repositoryRoot, manifestPath),
  schemaVersion: 1,
  sha256: createHash('sha256').update(manifestText).digest('hex'),
  gates: Object.fromEntries(
    LAUNCH_GATE_IDS.map((id) => [id, manifest.gates?.[id]?.status ?? 'missing']),
  ),
  errors: [...new Set(errors)],
};

console.log(JSON.stringify(result, null, 2));
if (result.errors.length > 0) process.exitCode = 1;
