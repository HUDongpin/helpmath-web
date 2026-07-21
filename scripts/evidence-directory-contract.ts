import {createHash} from 'node:crypto';
import {lstat, readFile, readdir, realpath} from 'node:fs/promises';
import path from 'node:path';

export type EvidenceDirectoryReference = Readonly<{
  reference: string;
  sha256: string;
}>;

type EvidenceDirectoryContractOptions = Readonly<{
  repositoryRoot: string;
  relativeDirectory: string;
  references: readonly EvidenceDirectoryReference[];
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DIRECT_JSON_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*\.json$/u;

function isInside(root: string, candidate: string): boolean {
  return candidate.startsWith(`${root}${path.sep}`);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function normalizedRepositoryDirectory(value: string): string | null {
  if (
    path.isAbsolute(value) ||
    value.includes('\\') ||
    value.includes('..') ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(value)
  ) {
    return null;
  }
  const normalized = path.posix.normalize(value);
  return normalized === value && normalized !== '.' ? normalized : null;
}

/**
 * Proves that an uploadable evidence directory contains exactly the referenced,
 * direct JSON files and verifies every regular file byte against its recorded
 * SHA-256. An absent directory is valid only when the reference set is empty.
 */
export async function validateEvidenceDirectoryContract(
  options: EvidenceDirectoryContractOptions,
): Promise<string[]> {
  const errors: string[] = [];
  const relativeDirectory = normalizedRepositoryDirectory(options.relativeDirectory);
  if (relativeDirectory === null) {
    return [`unsafe evidence directory: ${options.relativeDirectory}`];
  }

  const canonicalRepositoryRoot = await realpath(options.repositoryRoot);
  const directoryPath = path.resolve(canonicalRepositoryRoot, relativeDirectory);
  if (!isInside(canonicalRepositoryRoot, directoryPath)) {
    return [`evidence directory escapes the repository: ${relativeDirectory}`];
  }

  const expectedByName = new Map<string, EvidenceDirectoryReference>();
  const referencePrefix = `${relativeDirectory}/`;
  for (const [index, evidence] of options.references.entries()) {
    const reference = evidence.reference;
    const name = typeof reference === 'string' && reference.startsWith(referencePrefix)
      ? reference.slice(referencePrefix.length)
      : '';
    if (
      typeof reference !== 'string' ||
      name.length === 0 ||
      name.includes('/') ||
      !DIRECT_JSON_NAME_PATTERN.test(name)
    ) {
      errors.push(
        `evidence reference ${index} must be a direct non-hidden JSON file under ${relativeDirectory}`,
      );
      continue;
    }
    if (typeof evidence.sha256 !== 'string' || !SHA256_PATTERN.test(evidence.sha256)) {
      errors.push(`evidence reference ${reference} must record a lowercase SHA-256`);
    }
    if (expectedByName.has(name)) {
      errors.push(`evidence reference must not be repeated: ${reference}`);
      continue;
    }
    expectedByName.set(name, evidence);
  }

  let directoryMetadata;
  try {
    directoryMetadata = await lstat(directoryPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      if (expectedByName.size > 0) {
        errors.push(
          `${relativeDirectory} is missing but evidence references require ${JSON.stringify([...expectedByName.keys()].sort())}`,
        );
      }
      return [...new Set(errors)];
    }
    errors.push(
      `${relativeDirectory} could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [...new Set(errors)];
  }
  if (directoryMetadata.isSymbolicLink() || !directoryMetadata.isDirectory()) {
    errors.push(`${relativeDirectory} must be a regular non-symlink directory`);
    return [...new Set(errors)];
  }

  const canonicalDirectory = await realpath(directoryPath).catch(() => null);
  if (
    canonicalDirectory === null ||
    !isInside(canonicalRepositoryRoot, canonicalDirectory)
  ) {
    errors.push(`${relativeDirectory} resolves outside the repository`);
    return [...new Set(errors)];
  }

  let entries;
  try {
    entries = await readdir(directoryPath, {withFileTypes: true});
  } catch (error) {
    errors.push(
      `${relativeDirectory} could not be enumerated: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [...new Set(errors)];
  }
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));

  const expectedNames = [...expectedByName.keys()].sort((left, right) =>
    left.localeCompare(right, 'en'),
  );
  const actualNames = entries.map((entry) => entry.name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    errors.push(
      `${relativeDirectory} complete entry set must exactly equal referenced JSON files; expected ${JSON.stringify(expectedNames)}, found ${JSON.stringify(actualNames)}`,
    );
  }

  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    const filePath = path.join(directoryPath, entry.name);
    const metadata = await lstat(filePath).catch(() => null);
    if (
      metadata === null ||
      metadata.isSymbolicLink() ||
      !metadata.isFile() ||
      entry.isSymbolicLink() ||
      !entry.isFile()
    ) {
      errors.push(`${relativePath} must be a regular non-symlink file`);
      continue;
    }

    const canonicalFile = await realpath(filePath).catch(() => null);
    if (
      canonicalFile === null ||
      path.dirname(canonicalFile) !== canonicalDirectory ||
      !isInside(canonicalRepositoryRoot, canonicalFile)
    ) {
      errors.push(`${relativePath} resolves outside its evidence directory`);
      continue;
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(canonicalFile);
    } catch (error) {
      errors.push(
        `${relativePath} could not be read: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    const expected = expectedByName.get(entry.name);
    if (!expected) {
      errors.push(`${relativePath} has no evidence reference (SHA-256 ${actualSha256})`);
    } else if (actualSha256 !== expected.sha256) {
      errors.push(`${relativePath} SHA-256 does not match its evidence reference`);
    }
  }

  return [...new Set(errors)];
}
