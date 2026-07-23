import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import nextConfig from '../next.config';
import {demoIds, reviewDemoIds} from '../demos/catalog';
import {DEMO_CANDIDATE_IDS, demoCandidates} from '../demos/candidates';
import {
  EXECUTIVE_PREVIEW_ASSET_FILES,
  EXECUTIVE_PREVIEW_ASSET_OWNERS,
  EXECUTIVE_PREVIEW_RUNTIME_FILES,
  EXECUTIVE_PREVIEW_RUNTIME_OWNERS,
  isExecutivePreviewAssetPublic,
  isExecutivePreviewRuntimePublic,
  serveExecutivePreviewAsset,
  serveExecutivePreviewResource,
  serveExecutivePreviewRuntime,
} from '../lib/executive-preview-resources';

function assertPrivateHeaders(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
}

function assertPublicAssetHeaders(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('vary'), null);
  assert.equal(response.headers.get('x-robots-tag'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
}

describe('executive preview resource service', () => {
  it('allowlists candidate runtimes while access remains lifecycle-gated', () => {
    assert.deepEqual(
      Object.keys(EXECUTIVE_PREVIEW_RUNTIME_FILES).sort(),
      DEMO_CANDIDATE_IDS.map((id) => `${id}.js`).sort(),
    );
    assert.deepEqual(
      Object.keys(EXECUTIVE_PREVIEW_RUNTIME_OWNERS).sort(),
      DEMO_CANDIDATE_IDS.map((id) => `${id}.js`).sort(),
    );

    const assetDemoIds = [...new Set([...reviewDemoIds, ...demoIds])];
    const expectedAssets = assetDemoIds.flatMap((id) =>
      demoCandidates[id].artifacts
        .map(({path}) => path)
        .filter((path) => path.startsWith(`private-demo-assets/${id}/`))
        .map((path) => path.slice('private-demo-assets/'.length)),
    ).sort();
    assert.deepEqual(Object.keys(EXECUTIVE_PREVIEW_ASSET_FILES).sort(), expectedAssets);
    assert.deepEqual(Object.keys(EXECUTIVE_PREVIEW_ASSET_OWNERS).sort(), expectedAssets);
    for (const [assetPath, owner] of Object.entries(EXECUTIVE_PREVIEW_ASSET_OWNERS)) {
      assert.ok(assetPath.startsWith(`${owner}/`), assetPath);
    }
  });

  it('keeps current inactive assets private and returns the same empty 404 anonymously', async () => {
    const requestKey = 'conversion-1-2/gallon-0.png';
    const bytes = new Uint8Array([137, 80, 78, 71]);
    assert.equal(isExecutivePreviewAssetPublic(requestKey), false);

    const response = await serveExecutivePreviewAsset({
      authorized: false,
      headOnly: false,
      readFile: async () => bytes,
      requestKey,
      root: '/private',
    });

    assert.equal(response.status, 404);
    assert.equal((await response.arrayBuffer()).byteLength, 0);
    assertPrivateHeaders(response);

    const executivePreview = await serveExecutivePreviewAsset({
      authorized: true,
      headOnly: false,
      readFile: async () => bytes,
      requestKey,
      root: '/private',
    });
    assert.equal(executivePreview.status, 200);
    assert.deepEqual(new Uint8Array(await executivePreview.arrayBuffer()), bytes);
    assertPrivateHeaders(executivePreview);
  });

  it('allows anonymous reads only for an exact asset owned by a public lifecycle demo', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    let reads = 0;
    const response = await serveExecutivePreviewAsset({
      authorized: false,
      headOnly: false,
      publicDemoIds: ['conversion-1-2'],
      readFile: async () => {
        reads += 1;
        return bytes;
      },
      requestKey: 'conversion-1-2/gallon-0.png',
      root: '/private',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.equal(reads, 1);
    assertPublicAssetHeaders(response);

    for (const requestKey of [
      'conversion-1-4/pitcher-back.png',
      'conversion-1-2/../conversion-1-4/pitcher-back.png',
      'conversion-1-2/not-in-candidate.png',
      '../../package.json',
    ]) {
      const denied = await serveExecutivePreviewAsset({
        authorized: false,
        headOnly: false,
        publicDemoIds: ['conversion-1-2'],
        readFile: async () => {
          reads += 1;
          return bytes;
        },
        requestKey,
        root: '/private',
      });
      assert.equal(denied.status, 404, requestKey);
      assertPrivateHeaders(denied);
    }
    assert.equal(reads, 1);
  });

  it('rechecks public runtime access and falls back to the independent private session path', async () => {
    const requestKey = 'conversion-1-2.js';
    const bytes = new Uint8Array([47, 42, 32, 106, 115, 32, 42, 47]);
    let reads = 0;
    const readFile = async () => {
      reads += 1;
      return bytes;
    };

    assert.equal(
      isExecutivePreviewRuntimePublic(requestKey, ['conversion-1-2']),
      true,
    );
    const published = await serveExecutivePreviewRuntime({
      authorized: false,
      headOnly: false,
      publicDemoIds: ['conversion-1-2'],
      readFile,
      requestKey,
      root: '/private',
    });
    assert.equal(published.status, 200);
    assertPublicAssetHeaders(published);

    const gateClosed = await serveExecutivePreviewRuntime({
      authorized: false,
      headOnly: false,
      publicDemoIds: [],
      readFile,
      requestKey,
      root: '/private',
    });
    assert.equal(gateClosed.status, 404);
    assertPrivateHeaders(gateClosed);

    const privatePreview = await serveExecutivePreviewRuntime({
      authorized: true,
      headOnly: false,
      publicDemoIds: [],
      readFile,
      requestKey,
      root: '/private',
    });
    assert.equal(privatePreview.status, 200);
    assertPrivateHeaders(privatePreview);
    assert.equal(reads, 2);
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

  it('leaves asset cache policy to the lifecycle-aware route response', async () => {
    const headers = await nextConfig.headers?.();
    assert.ok(headers);
    const sources = headers.map(({source}) => source);

    assert.ok(sources.includes('/api/executive-preview/session'));
    assert.ok(sources.includes('/api/executive-preview/runtime/:path*'));
    assert.equal(sources.includes('/api/executive-preview/:path*'), false);
    assert.equal(sources.includes('/api/executive-preview/assets/:path*'), false);
  });
});
