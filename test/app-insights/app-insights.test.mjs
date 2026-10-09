import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppInsights } from '../../dist/app-insights/index.js';

test('configures Application Insights to propagate W3C trace context', () => {
  const calls = [];
  const configuration = {};
  const fluentMethods = [
    'setDistributedTracingMode',
    'setAutoCollectRequests',
    'setAutoCollectPerformance',
    'setAutoCollectExceptions',
    'setAutoCollectDependencies',
    'setAutoCollectConsole',
    'setAutoCollectPreAggregatedMetrics',
    'setSendLiveMetrics',
    'setInternalLogging',
    'enableWebInstrumentation',
  ];

  for (const method of fluentMethods) {
    configuration[method] = (...args) => {
      calls.push([method, ...args]);
      return configuration;
    };
  }
  configuration.start = () => calls.push(['start']);

  const sdk = {
    DistributedTracingModes: { AI_AND_W3C: 1 },
    defaultClient: {
      context: {
        tags: {},
        keys: { cloudRole: 'ai.cloud.role' },
      },
      trackTrace: (telemetry) => calls.push(['trackTrace', telemetry]),
    },
    setup: (connectionString) => {
      calls.push(['setup', connectionString]);
      return configuration;
    },
  };

  const config = new AppInsights(sdk).enable(true, 'connection-string', 'opal-frontend');

  assert.deepEqual(calls.slice(0, 2), [
    ['setup', 'connection-string'],
    ['setDistributedTracingMode', 1],
  ]);
  assert.deepEqual(calls.at(-2), ['start']);
  assert.deepEqual(calls.at(-1), ['trackTrace', { message: 'App insights activated' }]);
  assert.equal(sdk.defaultClient.context.tags['ai.cloud.role'], 'opal-frontend');
  assert.deepEqual(config, {
    enabled: true,
    connectionString: 'connection-string',
    cloudRoleName: 'opal-frontend',
  });
});
