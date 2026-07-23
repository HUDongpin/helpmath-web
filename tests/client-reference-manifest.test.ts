import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
  activeClientModulePaths,
  activeClientModuleSource,
} from '../scripts/client-reference-manifest.mjs';

const manifestPath = '[locale]/research/page_client-reference-manifest.js';

function webpackManifest(manifest: unknown) {
  return `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/[locale]/research/page"]=${JSON.stringify(manifest)};`;
}

function turbopackManifest(manifest: unknown) {
  return `
    globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};
    globalThis.__RSC_MANIFEST["/[locale]/research/page"] = ${JSON.stringify(manifest)};
  `;
}

const validManifest = {
  moduleLoading: {prefix: '/_next/'},
  clientModules: {
    '/components/static-shell.tsx': {
      id: 'static-shell',
      chunks: [],
      async: false,
    },
    '/components/client-island.tsx': {
      id: 'client-island',
      chunks: ['368', 'static/chunks/368-de61dff27e1c0555.js'],
      async: false,
    },
  },
};

describe('client reference manifest parsing', () => {
  it('extracts only active modules from Webpack output', () => {
    const source = webpackManifest(validManifest);

    assert.deepEqual(activeClientModulePaths(source, manifestPath), [
      '/components/client-island.tsx',
    ]);
    assert.equal(
      activeClientModuleSource(source, manifestPath),
      '/components/client-island.tsx',
    );
  });

  it('accepts the whitespace emitted by Turbopack output', () => {
    assert.deepEqual(
      activeClientModulePaths(turbopackManifest(validManifest), manifestPath),
      ['/components/client-island.tsx'],
    );
  });

  it('rejects unreadable assignments and invalid JSON', () => {
    assert.throws(
      () => activeClientModulePaths('export default {};', manifestPath),
      /has an unreadable client manifest/u,
    );
    assert.throws(
      () =>
        activeClientModulePaths(
          'globalThis.__RSC_MANIFEST["/page"]={"clientModules":};',
          manifestPath,
        ),
      /has invalid client manifest JSON/u,
    );
  });

  for (const [label, manifest, message] of [
    ['a non-object manifest', [], /client manifest must be a plain object/u],
    [
      'missing clientModules',
      {},
      /client manifest must define clientModules/u,
    ],
    [
      'a non-object clientModules value',
      {clientModules: []},
      /clientModules must be a plain object/u,
    ],
    [
      'a non-object module reference',
      {clientModules: {'/components/example.tsx': null}},
      /client module "\/components\/example\.tsx" must be a plain object/u,
    ],
    [
      'a module reference without chunks',
      {clientModules: {'/components/example.tsx': {id: 'example'}}},
      /client module "\/components\/example\.tsx" must define chunks/u,
    ],
    [
      'a non-array chunks value',
      {clientModules: {'/components/example.tsx': {chunks: 'chunk.js'}}},
      /client module "\/components\/example\.tsx" chunks must be an array/u,
    ],
    [
      'a non-string chunk',
      {clientModules: {'/components/example.tsx': {chunks: [7]}}},
      /chunk 0 must be a string/u,
    ],
    [
      'an empty chunk string',
      {clientModules: {'/components/example.tsx': {chunks: ['']}}},
      /chunk 0 must not be empty/u,
    ],
  ] as const) {
    it(`fails closed for ${label}`, () => {
      assert.throws(
        () => activeClientModulePaths(webpackManifest(manifest), manifestPath),
        message,
      );
    });
  }
});
