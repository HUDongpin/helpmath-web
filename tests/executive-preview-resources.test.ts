import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {reviewDemoIds} from '../demos/catalog';
import {demoCandidates} from '../demos/candidates';
import {
  EXECUTIVE_PREVIEW_ASSET_FILES,
  EXECUTIVE_PREVIEW_RUNTIME_FILES,
  serveExecutivePreviewResource,
} from '../lib/executive-preview-resources';

function assertPrivateHeaders(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
}

describe('executive preview resource service', () => {
  it('allowlists only lifecycle-approved private-preview runtimes and owned assets', () => {
    assert.deepEqual(
      Object.keys(EXECUTIVE_PREVIEW_RUNTIME_FILES).sort(),
      reviewDemoIds.map((id) => `${id}.js`).sort(),
    );

    const expectedAssets = reviewDemoIds.flatMap((id) =>
      demoCandidates[id].artifacts
        .map(({path}) => path)
        .filter((path) => path.startsWith(`private-demo-assets/${id}/`))
        .map((path) => path.slice('private-demo-assets/'.length)),
    ).sort();
    assert.deepEqual(Object.keys(EXECUTIVE_PREVIEW_ASSET_FILES).sort(), expectedAssets);
  });

  it('returns the same empty 404 for unauthorized and non-allowlisted requests', async () => {
    let reads = 0;
    const readFile = async () => {
      reads += 1;
      return new Uint8Array([1]);
    };
    const unauthorized = await serveExecutivePreviewResource({
      authorized: false,
      contentType: 'image/png',
      files: EXECUTIVE_PREVIEW_ASSET_FILES,
      headOnly: false,
      readFile,
      requestKey: 'conversion-1-2/gallon-0.png',
      root: '/private',
    });
    const absent = await serveExecutivePreviewResource({
      authorized: true,
      contentType: 'image/png',
      files: EXECUTIVE_PREVIEW_ASSET_FILES,
      headOnly: false,
      readFile,
      requestKey: '../../package.json',
      root: '/private',
    });

    for (const response of [unauthorized, absent]) {
      assert.equal(response.status, 404);
      assert.equal((await response.arrayBuffer()).byteLength, 0);
      assert.equal(response.headers.get('content-type'), null);
      assertPrivateHeaders(response);
    }
    assert.equal(reads, 0);
  });

  it('serves allowlisted bytes and preserves their length on HEAD', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    let resolvedPath = '';
    const readFile = async (absolutePath: string) => {
      resolvedPath = absolutePath;
      return bytes;
    };
    const options = {
      authorized: true,
      contentType: 'image/png',
      files: EXECUTIVE_PREVIEW_ASSET_FILES,
      readFile,
      requestKey: 'conversion-1-2/gallon-0.png',
      root: '/private',
    } as const;
    const response = await serveExecutivePreviewResource({...options, headOnly: false});

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('content-length'), String(bytes.byteLength));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.equal(resolvedPath, '/private/conversion-1-2/gallon-0.png');
    assertPrivateHeaders(response);

    const head = await serveExecutivePreviewResource({...options, headOnly: true});
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(bytes.byteLength));
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assertPrivateHeaders(head);
  });

  it('fails closed when a catalog mapping escapes its server-only root or cannot be read', async () => {
    const escaping = await serveExecutivePreviewResource({
      authorized: true,
      contentType: 'text/plain',
      files: {'allowed': '../secret'},
      headOnly: false,
      readFile: async () => new Uint8Array([1]),
      requestKey: 'allowed',
      root: '/private',
    });
    const missing = await serveExecutivePreviewResource({
      authorized: true,
      contentType: 'application/javascript; charset=utf-8',
      files: EXECUTIVE_PREVIEW_RUNTIME_FILES,
      headOnly: false,
      readFile: async () => { throw new Error('missing'); },
      requestKey: 'conversion-1-2.js',
      root: '/private',
    });

    assert.equal(escaping.status, 404);
    assert.equal(missing.status, 503);
    assertPrivateHeaders(escaping);
    assertPrivateHeaders(missing);
  });
});
