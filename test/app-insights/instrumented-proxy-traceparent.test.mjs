import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';
import express from 'express';
import appInsights from 'applicationinsights';
import opalApiProxy from '../../dist/proxy/opal-api-proxy/index.js';

const servers = [];
const browserTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

function configureInstrumentedApplicationInsights() {
  appInsights
    .setup('InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=http://127.0.0.1:1')
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(false)
    .setAutoCollectPerformance(false, false)
    .setAutoCollectConsole(false, false)
    .setAutoCollectPreAggregatedMetrics(false)
    .setAutoCollectHeartbeat(false)
    .setSendLiveMetrics(false)
    .setUseDiskRetryCaching(false)
    .enableWebInstrumentation(false)
    .start();

  appInsights.defaultClient.trackRequest = () => undefined;
  appInsights.defaultClient.trackDependency = () => undefined;
}

async function listen(handler) {
  const server = http.createServer(handler);
  servers.push(server);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, 'string');

  return {
    host: '127.0.0.1',
    port: address.port,
  };
}

async function request({ host, port }, headers) {
  return new Promise((resolve, reject) => {
    http
      .request(
        {
          hostname: host,
          port,
          path: '/opal-fines-service/minor-creditors',
          headers,
          disableAppInsightsAutoCollection: true,
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        },
      )
      .on('error', reject)
      .end();
  });
}

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

test('instrumented proxy sends a child traceparent header upstream', async () => {
  configureInstrumentedApplicationInsights();

  let upstreamTraceparent;
  const upstream = await listen((req, res) => {
    upstreamTraceparent = req.headers.traceparent;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });

  const app = express();
  app.use((req, _res, next) => {
    req.session = {};
    next();
  });
  app.use('/opal-fines-service', opalApiProxy(`http://${upstream.host}:${upstream.port}`, false, 100));
  const proxy = await listen(app);

  const statusCode = await request(proxy, { traceparent: browserTraceparent });
  const [, browserTraceId, browserSpanId, browserTraceFlags] = browserTraceparent.split('-');
  const [upstreamVersion, upstreamTraceId, upstreamSpanId, upstreamTraceFlags] = upstreamTraceparent.split('-');

  assert.equal(statusCode, 200);
  assert.equal(upstreamVersion, '00');
  assert.equal(upstreamTraceId, browserTraceId);
  assert.notEqual(upstreamSpanId, browserSpanId);
  assert.match(upstreamSpanId, /^[0-9a-f]{16}$/);
  assert.equal(upstreamTraceFlags, browserTraceFlags);
});
