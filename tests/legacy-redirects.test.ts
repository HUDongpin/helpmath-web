import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {legacyRedirects} from '../next.config';

describe('legacy HELP Program redirects', () => {
  it('permanently maps every audited legacy marketing page', async () => {
    const redirects = await legacyRedirects();
    const destinations = new Map(
      redirects.map((redirect) => [redirect.source, redirect.destination]),
    );
    assert.equal(redirects.length, 81);

    assert.equal(destinations.get('/favicon.ico'), '/icon.svg');
    assert.equal(destinations.get('/Home.htm'), '/');
    assert.equal(destinations.get('/Index.htm'), '/');
    assert.equal(destinations.get('/Contact.htm'), '/contact');
    assert.equal(destinations.get('/Ped.htm'), '/approach');
    assert.equal(destinations.get('/Kf.htm'), '/about');
    assert.equal(destinations.get('/ProgramInfo.htm'), '/curriculum#help-math-1-catalog');
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
      ['/About.htm', '/about'],
      ['/Mph.htm', '/about'],
      ['/Mth.htm', '/about'],
      ['/Csh.htm', '/about'],
      ['/Bah.htm', '/about'],
      ['/Bdh.htm', '/about'],
      ['/AcademicLanguage.htm', '/approach'],
      ['/SIOP.htm', '/approach'],
      ['/Sheltered.htm', '/approach'],
      ['/Content.htm', '/curriculum#help-math-1-catalog'],
      ['/Standards.htm', '/curriculum'],
      ['/As.htm', '/curriculum'],
      ['/Evidence.htm', '/research'],
      ['/Awards.htm', '/research'],
      ['/PR.htm', '/research'],
      ['/Rb.htm', '/research'],
      ['/onlineprogram.html', '/research'],
      ['/CODiE%20Award%20for%20Best%20Instructional%20Solution.pdf', '/resources#codie-past-winners'],
      ['/Codie%20Release%20DDI.pdf', '/resources#codie-past-winners'],
      ['/DDI%206-22-09NEWS%20RELEASE%20\\(final\\).pdf', '/research'],
      ['/Tst.htm', '/resources'],
      ['/Pd.htm', '/resources'],
      ['/Resources.htm', '/resources'],
      ['/Sales.htm', '/resources'],
      ['/Trial.htm', '/contact'],
      ['/Purchasing.htm', '/contact'],
      ['/Pricing.htm', '/contact'],
      ['/Gfs.htm', '/contact'],
      ['/district_login.aspx', '/login'],
      ['/school_login.aspx', '/login'],
      ['/student_login.aspx', '/login'],
      ['/teacher_login.aspx', '/login'],
      ['/user_studentlogin.aspx', '/login'],
      ['/student_register.aspx', '/login'],
      ['/teacher_register.aspx', '/login'],
      ['/trialuser_login.aspx', '/login'],
      ['/Project_Admin_Login.aspx', '/login'],
      ['/trial_register.aspx', '/contact'],
      ['/Login.htm', '/login'],
      ['/TechSpecs.htm', '/support'],
      ['/Ti.htm', '/support'],
      ['/Privacy.htm', '/privacy'],
    ] as const) {
      assert.equal(destinations.get(source), destination, source);
    }
    assert.equal(destinations.get('/Demo.htm'), '/demos');
    assert.equal(destinations.get('/PR/:path*'), '/research');
    for (const [source, destination] of [
      [
        '/DealerDocs/HELP%20Math%20Evaluation%20White%20Paper%205-13.pdf',
        '/research#help-math-pilot',
      ],
      [
        '/DealerDocs/U%20S%20%20Department%20of%20Education%20Research%20Summary%205-2013.pdf',
        '/research#wwc-tran-study',
      ],
      [
        '/DealerDocs/HELP%20Math%20self-efficacy%20in%20secondary%20students%20R.pdf',
        '/resources#freeman-2012-doi',
      ],
      [
        '/DealerDocs/What%20Works%20Clearinghouse_help_102312.pdf',
        '/resources#wwc-single-study-review',
      ],
      [
        '/DealerDocs/SCOPE%20and%20Sequence%202012.pdf',
        '/curriculum#help-math-1-catalog',
      ],
      [
        '/DealerDocs/Sheltered%20Instruction%20and%20scaffolding%20techniques%20in%20HELP%20Math%20final%202012.pdf',
        '/approach#support-layers',
      ],
      [
        '/DealerDocs/Sheltered%20Instruction%20and%20SPED%202012.pdf',
        '/approach#support-layers',
      ],
      [
        '/DealerDocs/INTEGRATION%20OF%20ACADEMIC%20LANGUAGE%20IN%20HELP%20MATH.pdf',
        '/approach#support-layers',
      ],
      [
        '/DealerDocs/HELP%20Math%20Overview%20of%20Reports%20\\(2010\\).pdf',
        '/curriculum#help-math-1-catalog',
      ],
      [
        '/DealerDocs/HELP%20Math%20as%20an%20RtI%20Solution%202012.pdf',
        '/curriculum#help-math-1-catalog',
      ],
      ['/DealerDocs/Ed%20Week%20Article.pdf', '/resources#education-week-2013'],
      [
        '/DealerDocs/TechnologyInnovations.pdf',
        '/resources#technology-innovations-report',
      ],
      ['/DealerDocs/Sage%20Publications%20article.pdf', '/resources#ell-curriculum-eric'],
      ['/DealerDocs/HelpMath%20print%208.5%20x%2011%20each.pdf', '/resources#about-help-math'],
      [
        '/teacher_guide/HELP%20Alignment%20v3.1.2-%20NCTM.pdf',
        '/curriculum#help-math-1-catalog',
      ],
    ] as const) {
      assert.equal(destinations.get(source), destination, source);
    }
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
