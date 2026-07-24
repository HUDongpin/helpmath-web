const kilobytes = value => value * 1024;
const lighthouseOrigin = 'http://127.0.0.1:3216';
const reviewedRoutes = ['/', '/es', '/research', '/resources', '/demos'];

// Rotate the first route once per round so every route occupies every temporal
// position exactly once. LHCI still launches a fresh Lighthouse/Chrome process
// for each sample, but no route is permanently assigned to the runner's cold
// start or final measurement window.
const collectionOrder = reviewedRoutes.flatMap((_, round) =>
  reviewedRoutes.map(
    (_, offset) => reviewedRoutes[(round + offset) % reviewedRoutes.length],
  ),
);

module.exports = {
  ci: {
    collect: {
      startServerCommand:
        'npm run start -- --hostname 127.0.0.1 --port 3216',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 30_000,
      url: collectionOrder.map(route => `${lighthouseOrigin}${route}`),
      // The URL list contains five balanced rounds, so one LHCI run per entry
      // still produces exactly five fresh samples for every reviewed route.
      numberOfRuns: 1,
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
