import type {NextConfig} from 'next';

import {DRAFT_LEGAL_PATHS} from './lib/legal-publishing';
import {routablePagePaths} from './lib/public-paths';
import {demoRoutes, indexableDemoRoutes, reviewDemoRoutes} from './demos/catalog';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self' https://challenges.cloudflare.com",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src https://challenges.cloudflare.com",
      "img-src 'self' data: blob:",
      "object-src 'none'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'wasm-unsafe-eval'"} https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'"
    ].join('; ')
  },
  {key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups'},
  {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
  {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
  {key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload'},
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'X-Frame-Options', value: 'DENY'}
];

const draftLegalHeaders = DRAFT_LEGAL_PATHS.map((source) => ({
  source,
  headers: [{key: 'X-Robots-Tag', value: 'noindex, follow'}]
}));

const indexableDemoRouteSet = new Set(indexableDemoRoutes);
const publicDemoRouteSet = new Set(demoRoutes);
const privateOnlyReviewDemoRoutes = reviewDemoRoutes.filter(
  (route) => !publicDemoRouteSet.has(route),
);
const conditionalDemoHeaders = demoRoutes
  .filter((route) => !indexableDemoRouteSet.has(route))
  .flatMap((route) => [route, `/es${route}`])
  .map((source) => ({
    source,
    headers: [{key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive'}]
  }));

const executivePreviewHeaders = [
  '/executive-preview',
  '/es/executive-preview',
  ...privateOnlyReviewDemoRoutes,
  ...privateOnlyReviewDemoRoutes.map((route) => `/es${route}`),
  '/api/executive-preview/session',
  '/api/executive-preview/runtime/:path*',
  '/flash-assets/:path*',
].map((source) => ({
  source,
  headers: [
    {key: 'Cache-Control', value: 'private, no-store, max-age=0'},
    {key: 'Vary', value: 'Cookie'},
    {key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive'},
  ],
}));

const nonIndexableLegacyPaths = [
  '/Images/Help_Slideshow.swf',
  '/0214%20Sunburst%20and%20BLI%20Form%20partnership%20for%20HELP%20Math2.pdf'
] as const;

const nonIndexableLegacyHeaders = nonIndexableLegacyPaths.map((source) => ({
  source,
  headers: [{key: 'X-Robots-Tag', value: 'noindex, nofollow'}]
}));

const staticMarketingPages: ReadonlyMap<string, string> = new Map([
  ['/', 'home'],
  ['/demos', 'demos'],
  ['/research', 'research'],
  ['/resources', 'resources'],
] as const);

export const legacyRedirects: NonNullable<NextConfig['redirects']> = async () => [
  {source: '/favicon.ico', destination: '/icon.svg', permanent: true},
  {source: '/Home.htm', destination: '/', permanent: true},
  {source: '/Index.htm', destination: '/', permanent: true},
  {source: '/About.htm', destination: '/about', permanent: true},
  {source: '/ProgramInfo.htm', destination: '/curriculum#help-math-1-catalog', permanent: true},
  {source: '/Kf.htm', destination: '/about', permanent: true},
  {source: '/Mph.htm', destination: '/about', permanent: true},
  {source: '/Mth.htm', destination: '/about', permanent: true},
  {source: '/Csh.htm', destination: '/about', permanent: true},
  {source: '/Bah.htm', destination: '/about', permanent: true},
  {source: '/Bdh.htm', destination: '/about', permanent: true},
  {source: '/AcademicLanguage.htm', destination: '/approach', permanent: true},
  {source: '/Ped.htm', destination: '/approach', permanent: true},
  {source: '/SIOP.htm', destination: '/approach', permanent: true},
  {source: '/Sheltered.htm', destination: '/approach', permanent: true},
  {source: '/Sheltered%20Instruction.wmv', destination: '/approach', permanent: true},
  {source: '/Content.htm', destination: '/curriculum#help-math-1-catalog', permanent: true},
  {source: '/Standards.htm', destination: '/curriculum', permanent: true},
  {source: '/As.htm', destination: '/curriculum', permanent: true},
  {
    source: '/HELP%20Math%20Correlations%20CCS%203-4-5%209%2028%2010%20v2.pdf',
    destination: '/curriculum',
    permanent: true
  },
  {
    source: '/HELP%20Math%20Correlations%20CCS%206%207%208.pdf',
    destination: '/curriculum',
    permanent: true
  },
  {source: '/HELP_Alignment_CO.pdf', destination: '/curriculum', permanent: true},
  {source: '/Evidence.htm', destination: '/research', permanent: true},
  {source: '/Awards.htm', destination: '/research', permanent: true},
  {source: '/Testimonials.htm', destination: '/research', permanent: true},
  {source: '/PR.htm', destination: '/research', permanent: true},
  {source: '/Rb.htm', destination: '/research', permanent: true},
  {source: '/onlineprogram.html', destination: '/research', permanent: true},
  {
    source: '/CODiE%20Award%20for%20Best%20Instructional%20Solution.pdf',
    destination: '/resources#codie-past-winners',
    permanent: true
  },
  {source: '/Codie%20Release%20DDI.pdf', destination: '/resources#codie-past-winners', permanent: true},
  {
    source: '/DDI%206-22-09NEWS%20RELEASE%20\\(final\\).pdf',
    destination: '/research',
    permanent: true
  },
  {
    source: '/HELP%20evaluation%20white%20paper%20June%202005.pdf',
    destination: '/research',
    permanent: true
  },
  {
    source: '/U%20S%20%20Department%20of%20Education%20Research%20Summary%205-2013.pdf',
    destination: '/research',
    permanent: true
  },
  {
    source:
      '/THE%20IMPORTANCE%20OF%20ACADEMIC%20LANGUAGE%20in%20Achieving%20Content%20Area%20Mastery.pdf',
    destination: '/research',
    permanent: true
  },
  {source: '/Resources.htm', destination: '/resources', permanent: true},
  {source: '/Tst.htm', destination: '/resources', permanent: true},
  {source: '/Pd.htm', destination: '/resources', permanent: true},
  {source: '/Sales.htm', destination: '/resources', permanent: true},
  {source: '/Trial.htm', destination: '/contact', permanent: true},
  {source: '/Purchasing.htm', destination: '/contact', permanent: true},
  {source: '/PurchaseInfo.htm', destination: '/contact', permanent: true},
  {source: '/Contact.htm', destination: '/contact', permanent: true},
  {source: '/Pricing.htm', destination: '/contact', permanent: true},
  {source: '/Gfs.htm', destination: '/contact', permanent: true},
  {source: '/trial_register.aspx', destination: '/contact', permanent: true},
  {source: '/Login.htm', destination: '/login', permanent: true},
  {source: '/district_login.aspx', destination: '/login', permanent: true},
  {source: '/school_login.aspx', destination: '/login', permanent: true},
  {source: '/student_login.aspx', destination: '/login', permanent: true},
  {source: '/teacher_login.aspx', destination: '/login', permanent: true},
  {source: '/user_studentlogin.aspx', destination: '/login', permanent: true},
  {source: '/student_register.aspx', destination: '/login', permanent: true},
  {source: '/teacher_register.aspx', destination: '/login', permanent: true},
  {source: '/trialuser_login.aspx', destination: '/login', permanent: true},
  {source: '/Project_Admin_Login.aspx', destination: '/login', permanent: true},
  {source: '/TechSpecs.htm', destination: '/support', permanent: true},
  {source: '/Ti.htm', destination: '/support', permanent: true},
  {source: '/Privacy.htm', destination: '/privacy', permanent: true},
  {
    source: '/HELP%20Math%20Privacy%20Policy%203.12.07.pdf',
    destination: '/privacy',
    permanent: true
  },
  {
    source: '/HELP%20Math%20Privacy%20Policy%203.12.07.doc',
    destination: '/privacy',
    permanent: true
  },
  {source: '/Demo.htm', destination: '/demos', permanent: true},
  {source: '/shortdemo/:path*', destination: '/demos', permanent: true},
  {source: '/PR/:path*', destination: '/research', permanent: true},
  {
    source: '/DealerDocs/HELP%20Math%20Evaluation%20White%20Paper%205-13.pdf',
    destination: '/research#help-math-pilot',
    permanent: true
  },
  {
    source: '/DealerDocs/U%20S%20%20Department%20of%20Education%20Research%20Summary%205-2013.pdf',
    destination: '/research#wwc-tran-study',
    permanent: true
  },
  {
    source: '/DealerDocs/HELP%20Math%20self-efficacy%20in%20secondary%20students%20R.pdf',
    destination: '/resources#freeman-2012-doi',
    permanent: true
  },
  {
    source: '/DealerDocs/What%20Works%20Clearinghouse_help_102312.pdf',
    destination: '/resources#wwc-single-study-review',
    permanent: true
  },
  {
    source: '/DealerDocs/SCOPE%20and%20Sequence%202012.pdf',
    destination: '/curriculum#help-math-1-catalog',
    permanent: true
  },
  {
    source: '/DealerDocs/Sheltered%20Instruction%20and%20scaffolding%20techniques%20in%20HELP%20Math%20final%202012.pdf',
    destination: '/approach#support-layers',
    permanent: true
  },
  {
    source: '/DealerDocs/Sheltered%20Instruction%20and%20SPED%202012.pdf',
    destination: '/approach#support-layers',
    permanent: true
  },
  {
    source: '/DealerDocs/INTEGRATION%20OF%20ACADEMIC%20LANGUAGE%20IN%20HELP%20MATH.pdf',
    destination: '/approach#support-layers',
    permanent: true
  },
  {
    source: '/DealerDocs/HELP%20Math%20Overview%20of%20Reports%20\\(2010\\).pdf',
    destination: '/curriculum#help-math-1-catalog',
    permanent: true
  },
  {
    source: '/DealerDocs/HELP%20Math%20as%20an%20RtI%20Solution%202012.pdf',
    destination: '/curriculum#help-math-1-catalog',
    permanent: true
  },
  {
    source: '/DealerDocs/Ed%20Week%20Article.pdf',
    destination: '/resources#education-week-2013',
    permanent: true
  },
  {
    source: '/DealerDocs/TechnologyInnovations.pdf',
    destination: '/resources#technology-innovations-report',
    permanent: true
  },
  {
    source: '/DealerDocs/Sage%20Publications%20article.pdf',
    destination: '/resources#ell-curriculum-eric',
    permanent: true
  },
  {
    source: '/DealerDocs/HelpMath%20print%208.5%20x%2011%20each.pdf',
    destination: '/resources#about-help-math',
    permanent: true
  },
  {
    source: '/teacher_guide/HELP%20Alignment%20v3.1.2-%20NCTM.pdf',
    destination: '/curriculum#help-math-1-catalog',
    permanent: true
  },
  {source: '/DealerDocs/:path*', destination: '/resources', permanent: true},
  {source: '/teacher_guide/:path*', destination: '/resources', permanent: true},
  {source: '/Beta/:path*', destination: '/curriculum', permanent: true},
  {source: '/beta/:path*', destination: '/curriculum', permanent: true}
];

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
  },
  images: {
    localPatterns: [],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  // Let proxy.ts sanitize private-entry queries before any permanent URL
  // normalization can echo them into Location, Refresh, or response bodies.
  skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  outputFileTracingIncludes: {
    '/api/executive-preview/assets/[...asset]': ['./private-demo-assets/**/*.png'],
    '/api/executive-preview/runtime/[id]': [
      './.next-private/executive-demo-runtime/*.js',
    ],
  },
  async headers() {
    return [
      ...draftLegalHeaders,
      ...conditionalDemoHeaders,
      ...executivePreviewHeaders,
      ...nonIndexableLegacyHeaders,
      {source: '/(.*)', headers: securityHeaders}
    ];
  },
  redirects: legacyRedirects,
  async rewrites() {
    return [
      ...[...staticMarketingPages].map(([source, page]) => ({
        source: `/es${source === '/' ? '' : source}`,
        destination: `/static/es/${page}`,
      })),
      ...routablePagePaths.map((source) => {
        const staticPage = staticMarketingPages.get(source);
        return {
          source,
          destination: staticPage
            ? `/static/en/${staticPage}`
            : `/en${source === '/' ? '' : source}`,
        };
      }),
    ];
  },
};

export default nextConfig;
