import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  runLighthouseWithInfrastructureRetry,
  shouldRetryLighthouseInfrastructureFailure,
} from '../scripts/run-lighthouse-ci.mjs';

const noNavigationStart =
  'Runtime error encountered: Something went wrong with recording the trace over your page load. Please run Lighthouse again. (NO_NAVSTART)\n';

describe('Lighthouse infrastructure retry', () => {
  it('recognizes only the exact terminal error with no finalized reports', () => {
    assert.equal(
      shouldRetryLighthouseInfrastructureFailure({
        exitCode: 1,
        output: noNavigationStart,
        finalizedReportCount: 0,
      }),
      true,
    );
    assert.equal(
      shouldRetryLighthouseInfrastructureFailure({
        exitCode: 0,
        output: noNavigationStart,
        finalizedReportCount: 0,
      }),
      false,
    );
    assert.equal(
      shouldRetryLighthouseInfrastructureFailure({
        exitCode: 1,
        output: noNavigationStart,
        finalizedReportCount: 1,
      }),
      false,
    );
    assert.equal(
      shouldRetryLighthouseInfrastructureFailure({
        exitCode: 1,
        output: 'Lighthouse assertions failed.\n',
        finalizedReportCount: 0,
      }),
      false,
    );
    assert.equal(
      shouldRetryLighthouseInfrastructureFailure({
        exitCode: 1,
        output: noNavigationStart + noNavigationStart,
        finalizedReportCount: 0,
      }),
      false,
    );
  });

  it('retries the complete collection exactly once after NO_NAVSTART', async () => {
    const invocations = [
      {exitCode: 1, output: noNavigationStart},
      {exitCode: 0, output: 'success'},
    ];
    let invokeCount = 0;
    let resetCount = 0;
    let recordCount = 0;

    const exitCode = await runLighthouseWithInfrastructureRetry({
      invoke: async () => invocations[invokeCount++],
      resetGeneratedOutputs: async () => {
        resetCount += 1;
      },
      countFinalizedReports: async () => 0,
      recordRetry: async () => {
        recordCount += 1;
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(invokeCount, 2);
    assert.equal(resetCount, 2);
    assert.equal(recordCount, 1);
  });

  it('never performs a third collection when the replacement fails', async () => {
    let invokeCount = 0;
    const exitCode = await runLighthouseWithInfrastructureRetry({
      invoke: async () => {
        invokeCount += 1;
        return {exitCode: 1, output: noNavigationStart};
      },
      resetGeneratedOutputs: async () => {},
      countFinalizedReports: async () => 0,
      recordRetry: async () => {},
    });

    assert.equal(exitCode, 1);
    assert.equal(invokeCount, 2);
  });

  it('does not retry a product failure or a successful collection', async () => {
    for (const first of [
      {exitCode: 1, output: 'Lighthouse assertions failed.\n'},
      {exitCode: 0, output: 'success'},
    ]) {
      let invokeCount = 0;
      const exitCode = await runLighthouseWithInfrastructureRetry({
        invoke: async () => {
          invokeCount += 1;
          return first;
        },
        resetGeneratedOutputs: async () => {},
        countFinalizedReports: async () => 0,
        recordRetry: async () => {
          assert.fail('A non-infrastructure result must not be retried');
        },
      });

      assert.equal(exitCode, first.exitCode);
      assert.equal(invokeCount, 1);
    }
  });
});
