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
    assert.equal(destinations.get('/Kf.htm'), '/about');
    assert.equal(destinations.get('/ProgramInfo.htm'), '/about');
    assert.equal(destinations.get('/PurchaseInfo.htm'), '/contact');
    assert.equal(destinations.get('/Testimonials.htm'), '/research');
    assert.equal(
      destinations.get('/HELP%20Math%20Privacy%20Policy%203.12.07.pdf'),
      '/privacy',
    );
    for (const [source, destination] of [
      ['/HELP%20Math%20Privacy%20Policy%203.12.07.doc', '/privacy'],
      ['/Sheltered%20Instruction.wmv', '/approach'],
      ['/HELP%20evaluation%20white%20paper%20June%202005.pdf', '/research'],
      [
        '/U%20S%20%20Department%20of%20Education%20Research%20Summary%205-2013.pdf',
        '/research',
      ],
      [
        '/THE%20IMPORTANCE%20OF%20ACADEMIC%20LANGUAGE%20in%20Achieving%20Content%20Area%20Mastery.pdf',
        '/research',
      ],
      [
        '/HELP%20Math%20Correlations%20CCS%203-4-5%209%2028%2010%20v2.pdf',
        '/curriculum',
      ],
      ['/HELP%20Math%20Correlations%20CCS%206%207%208.pdf', '/curriculum'],
      ['/HELP_Alignment_CO.pdf', '/curriculum'],
      ['/district_login.aspx', '/login'],
      ['/school_login.aspx', '/login'],
      ['/student_login.aspx', '/login'],
      ['/teacher_login.aspx', '/login'],
      ['/user_studentlogin.aspx', '/login'],
      ['/trial_register.aspx', '/contact'],
    ] as const) {
      assert.equal(destinations.get(source), destination, source);
    }
    assert.equal(destinations.get('/Demo.htm'), '/demos');
    assert.equal(destinations.get('/PR/:path*'), '/research');
    assert.equal(destinations.get('/DealerDocs/:path*'), '/resources');
    assert.equal(destinations.get('/teacher_guide/:path*'), '/resources');
    assert.equal(destinations.get('/shortdemo/:path*'), '/demos');
    assert.equal(destinations.get('/Beta/:path*'), '/curriculum');
    assert.equal(destinations.get('/Images/Help_Slideshow.swf'), undefined);
    assert.equal(
      destinations.get(
        '/0214%20Sunburst%20and%20BLI%20Form%20partnership%20for%20HELP%20Math2.pdf',
      ),
      undefined,
    );
    assert.ok(redirects.every((redirect) => redirect.permanent));
    assert.equal(new Set(redirects.map((redirect) => redirect.source)).size, redirects.length);
  });
});
