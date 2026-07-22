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
        'http://127.0.0.1:3216/demos',
      ],
      numberOfRuns: 3,
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
          {maxNumericValue: kilobytes(450)},
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
