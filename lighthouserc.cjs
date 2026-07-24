const kilobytes = value => value * 1024;

module.exports = {
  ci: {
    collect: {
      startServerCommand:
        'npm run start -- --hostname 127.0.0.1 --port 3216',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 30_000,
      url: [
        'http://127.0.0.1:3216/',
        'http://127.0.0.1:3216/es',
        'http://127.0.0.1:3216/research',
        'http://127.0.0.1:3216/resources',
        'http://127.0.0.1:3216/demos',
      ],
      // Five fresh Lighthouse/Chrome processes on the shared runner keep the
      // strict median budget resilient to one isolated V8 or parser stall.
      numberOfRuns: 5,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      aggregationMethod: 'median',
      assertions: {
        'categories:performance': ['error', {minScore: 0.9}],
        'categories:accessibility': ['error', {minScore: 1}],
        'categories:best-practices': ['error', {minScore: 1}],
        'categories:seo': ['error', {minScore: 1}],
        'largest-contentful-paint': [
          'error',
          {maxNumericValue: 3_000},
        ],
        'cumulative-layout-shift': [
          'error',
          {maxNumericValue: 0.1},
        ],
        'total-blocking-time': ['error', {maxNumericValue: 200}],
        'total-byte-weight': [
          'error',
          {maxNumericValue: kilobytes(320)},
        ],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: 'artifacts/lighthouse-ci',
      reportFilenamePattern:
        '%%PATHNAME%%-%%DATETIME%%.report.%%EXTENSION%%',
    },
  },
};
