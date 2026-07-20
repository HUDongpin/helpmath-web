import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {legacyRedirects} from '../next.config';

describe('legacy HELP Program redirects', () => {
  it('permanently maps every audited legacy marketing page', async () => {
    const redirects = await legacyRedirects();
    const destinations = new Map(
      redirects.map((redirect) => [redirect.source, redirect.destination]),
    );

    assert.equal(destinations.get('/Home.htm'), '/');
    assert.equal(destinations.get('/Index.htm'), '/');
    assert.equal(destinations.get('/Contact.htm'), '/contact');
    assert.equal(destinations.get('/Ped.htm'), '/approach');
    assert.equal(destinations.get('/ProgramInfo.htm'), '/about');
    assert.equal(destinations.get('/PurchaseInfo.htm'), '/contact');
    assert.equal(destinations.get('/Testimonials.htm'), '/research');
    assert.equal(destinations.get('/Demo.htm'), '/demos');
    assert.equal(destinations.get('/PR/:path*'), '/research');
    assert.equal(destinations.get('/DealerDocs/:path*'), '/resources');
    assert.equal(destinations.get('/shortdemo/:path*'), '/demos');
    assert.equal(destinations.get('/Beta/:path*'), '/curriculum');
    assert.ok(redirects.every((redirect) => redirect.permanent));
    assert.equal(new Set(redirects.map((redirect) => redirect.source)).size, redirects.length);
  });
});
