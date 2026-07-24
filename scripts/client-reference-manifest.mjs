import assert from 'node:assert/strict';

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseManifestJson(json, relativePath) {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`${relativePath} has invalid client manifest JSON.`, {
      cause: error,
    });
  }
}

export function activeClientModulePaths(source, relativePath) {
  assert.equal(
    typeof source,
    'string',
    `${relativePath} client manifest source must be a string.`,
  );
  assert.equal(
    typeof relativePath,
    'string',
    'Client manifest relative path must be a string.',
  );
  assert.ok(relativePath.length > 0, 'Client manifest relative path must not be empty.');

  const assignment = source.match(
    /__RSC_MANIFEST\["(?:\\.|[^"])*"\]\s*=\s*(.+?);?\s*$/su,
  );
  assert.ok(assignment, `${relativePath} has an unreadable client manifest.`);

  const manifest = parseManifestJson(assignment[1], relativePath);
  assert.ok(
    isPlainObject(manifest),
    `${relativePath} client manifest must be a plain object.`,
  );
  assert.ok(
    Object.hasOwn(manifest, 'clientModules'),
    `${relativePath} client manifest must define clientModules.`,
  );
  assert.ok(
    isPlainObject(manifest.clientModules),
    `${relativePath} clientModules must be a plain object.`,
  );

  const activeModules = [];
  for (const [modulePath, moduleReference] of Object.entries(
    manifest.clientModules,
  )) {
    assert.ok(
      modulePath.length > 0,
      `${relativePath} clientModules must not contain an empty module path.`,
    );
    assert.ok(
      isPlainObject(moduleReference),
      `${relativePath} client module ${JSON.stringify(modulePath)} must be a plain object.`,
    );
    assert.ok(
      Object.hasOwn(moduleReference, 'chunks'),
      `${relativePath} client module ${JSON.stringify(modulePath)} must define chunks.`,
    );
    assert.ok(
      Array.isArray(moduleReference.chunks),
      `${relativePath} client module ${JSON.stringify(modulePath)} chunks must be an array.`,
    );

    for (const [chunkIndex, chunk] of moduleReference.chunks.entries()) {
      assert.equal(
        typeof chunk,
        'string',
        `${relativePath} client module ${JSON.stringify(modulePath)} chunk ${chunkIndex} must be a string.`,
      );
      assert.ok(
        chunk.length > 0,
        `${relativePath} client module ${JSON.stringify(modulePath)} chunk ${chunkIndex} must not be empty.`,
      );
    }

    if (moduleReference.chunks.length > 0) {
      activeModules.push(modulePath);
    }
  }

  return activeModules;
}

export function activeClientModuleSource(source, relativePath) {
  return activeClientModulePaths(source, relativePath).join('\n');
}
