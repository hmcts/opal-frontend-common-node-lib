import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, test } from 'node:test';
import express from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import opalApiProxy from '../../dist/proxy/opal-api-proxy/index.js';

const servers = [];
const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
const spanId = '00f067aa0ba902b7';

function sha512ContentDigest(value) {
  return `sha-512=:${crypto.createHash('sha512').update(value).digest('base64')}:`;
}

async function listen(handler) {
  const server = http.createServer(handler);
  servers.push(server);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, 'string');

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http
      .request(url, { headers }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      })
      .on('error', reject)
      .end();
  });
}

async function createProxyServer(target, timeoutInMilliseconds = 100) {
  const app = express();
  app.use((req, _res, next) => {
    req.session = {};
    next();
  });
  app.use('/opal-fines-service', opalApiProxy(target, false, timeoutInMilliseconds));

  return listen(app);
}

function captureProxyWarn() {
  const logger = Logger.getLogger('opalApiProxy');
  const originalWarn = logger.warn;
  const calls = [];

  logger.warn = (...args) => {
    calls.push(args);
  };

  return {
    calls,
    restore: () => {
      logger.warn = originalWarn;
    },
  };
}

function assertGatewayFailureLog(warn, expectedMetadata) {
  assert.equal(warn.calls.length, 1);

  const [message, metadata] = warn.calls[0];
  assert.equal(message, 'Proxy gateway failure response');
  assert.deepEqual(
    {
      operationId: metadata.operationId,
      method: metadata.method,
      path: metadata.path,
      target: metadata.target,
      statusCode: metadata.statusCode,
      retriable: metadata.retriable,
      errorType: metadata.errorType,
      code: metadata.code,
    },
    expectedMetadata,
  );
  assert.equal(typeof metadata.elapsedMs, 'number');
  assert.ok(metadata.elapsedMs >= 0);
}

function assertNoSensitiveLogValues(warn) {
  assert.doesNotMatch(
    JSON.stringify(warn.calls),
    /secret|Bearer|QQ123456C|accountNumber|socket timeout|token|password|user:|12345|Sensitive|defendants/,
  );
}

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

test('proxy timeout returns OPAL problem JSON with operation id', async () => {
  const upstream = await listen(() => undefined);
  const proxy = await createProxyServer(upstream.url, 30);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    traceparent: `00-${traceId}-${spanId}-01`,
  });

  assert.equal(response.statusCode, 504);
  assert.match(response.headers['content-type'], /^application\/problem\+json/);
  assert.equal(response.headers['content-length'], Buffer.byteLength(response.body).toString());
  assert.notEqual(response.body, '');
  assert.deepEqual(JSON.parse(response.body), {
    title: 'Gateway Timeout',
    status: 504,
    detail: 'The backend service did not respond in time.',
    retriable: true,
    operation_id: traceId,
  });
});

test('proxy timeout uses operation id from request-id when traceparent is unavailable', async () => {
  const upstream = await listen(() => undefined);
  const proxy = await createProxyServer(upstream.url, 30);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    'request-id': `|${traceId}.${spanId}.`,
  });

  assert.equal(response.statusCode, 504);
  assert.equal(JSON.parse(response.body).operation_id, traceId);
});

test('proxy timeout generates fallback operation id when correlation headers are unavailable', async () => {
  const upstream = await listen(() => undefined);
  const proxy = await createProxyServer(upstream.url, 30);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`);

  assert.equal(response.statusCode, 504);
  assert.match(
    JSON.parse(response.body).operation_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('gateway HTML 504 is normalised, logged and response digest is removed', async () => {
  const html = '<html><body>Gateway timeout</body></html>';
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Digest': sha512ContentDigest(html),
    });
    res.end(html);
  });
  const proxy = await createProxyServer(upstream.url);
  const warn = captureProxyWarn();

  try {
    const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
      traceparent: `00-${traceId}-${spanId}-01`,
    });

    assert.equal(response.statusCode, 504);
    assert.match(response.headers['content-type'], /^application\/problem\+json/);
    assert.equal(response.headers['content-digest'], undefined);
    assert.deepEqual(JSON.parse(response.body), {
      title: 'Gateway Timeout',
      status: 504,
      detail: 'The backend service did not respond in time.',
      retriable: true,
      operation_id: traceId,
    });
    assertGatewayFailureLog(warn, {
      operationId: traceId,
      method: 'GET',
      path: '/opal-fines-service',
      target: new URL(upstream.url).host,
      statusCode: 504,
      retriable: true,
      errorType: undefined,
      code: undefined,
    });
    assertNoSensitiveLogValues(warn);
  } finally {
    warn.restore();
  }
});

test('gateway HTML 504 completes even when upstream response body never ends', async () => {
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.write('<html><body>Gateway timeout');
  });
  const proxy = await createProxyServer(upstream.url);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    traceparent: `00-${traceId}-${spanId}-01`,
  });

  assert.equal(response.statusCode, 504);
  assert.match(response.headers['content-type'], /^application\/problem\+json/);
  assert.equal(response.headers['content-length'], Buffer.byteLength(response.body).toString());
  assert.deepEqual(JSON.parse(response.body), {
    title: 'Gateway Timeout',
    status: 504,
    detail: 'The backend service did not respond in time.',
    retriable: true,
    operation_id: traceId,
  });
});

test('existing OPAL error response is preserved', async () => {
  const body = JSON.stringify({
    title: 'Gateway Timeout',
    status: 504,
    detail: 'Upstream OPAL timeout',
    retriable: true,
    operation_id: 'upstream-operation-id',
  });
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'application/problem+json; charset=utf-8',
    });
    res.end(body);
  });
  const proxy = await createProxyServer(upstream.url);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    traceparent: `00-${traceId}-${spanId}-01`,
  });

  assert.equal(response.statusCode, 504);
  assert.match(response.headers['content-type'], /^application\/problem\+json/);
  assert.equal(response.body, body);
});

test('legacy OPAL error response without operation id is given one and logged', async () => {
  const body = JSON.stringify({
    title: 'Gateway Timeout',
    status: 504,
    detail: 'Upstream OPAL timeout',
    retriable: true,
  });
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'Content-Digest': sha512ContentDigest(body),
    });
    res.end(body);
  });
  const proxy = await createProxyServer(upstream.url);
  const warn = captureProxyWarn();

  try {
    const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
      traceparent: `00-${traceId}-${spanId}-01`,
    });

    assert.equal(response.statusCode, 504);
    assert.match(response.headers['content-type'], /^application\/problem\+json/);
    assert.equal(response.headers['content-digest'], undefined);
    assert.deepEqual(JSON.parse(response.body), {
      title: 'Gateway Timeout',
      status: 504,
      detail: 'Upstream OPAL timeout',
      retriable: true,
      operation_id: traceId,
    });
    assertGatewayFailureLog(warn, {
      operationId: traceId,
      method: 'GET',
      path: '/opal-fines-service',
      target: new URL(upstream.url).host,
      statusCode: 504,
      retriable: true,
      errorType: undefined,
      code: undefined,
    });
    assertNoSensitiveLogValues(warn);
  } finally {
    warn.restore();
  }
});

test('legacy OPAL error response with invalid digest is rejected before operation id injection', async () => {
  const body = JSON.stringify({
    title: 'Gateway Timeout',
    status: 504,
    detail: 'Upstream OPAL timeout',
    retriable: true,
  });
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'Content-Digest': sha512ContentDigest(`${body}tampered`),
    });
    res.end(body);
  });
  const proxy = await createProxyServer(upstream.url);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    traceparent: `00-${traceId}-${spanId}-01`,
  });

  assert.equal(response.statusCode, 502);
  assert.match(response.headers['content-type'], /^text\/plain/);
  assert.equal(response.headers['content-digest'], undefined);
  assert.equal(response.body, 'Upstream Content-Digest verification failed');
});

test('legacy OPAL error response with blank operation id is given one', async () => {
  const body = JSON.stringify({
    title: 'Gateway Timeout',
    status: 504,
    detail: 'Upstream OPAL timeout',
    retriable: true,
    operation_id: '   ',
  });
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'application/problem+json; charset=utf-8',
    });
    res.end(body);
  });
  const proxy = await createProxyServer(upstream.url);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    traceparent: `00-${traceId}-${spanId}-01`,
  });

  assert.equal(response.statusCode, 504);
  assert.match(response.headers['content-type'], /^application\/problem\+json/);
  assert.deepEqual(JSON.parse(response.body), {
    title: 'Gateway Timeout',
    status: 504,
    detail: 'Upstream OPAL timeout',
    retriable: true,
    operation_id: traceId,
  });
});

test('safe logging uses service label and excludes dynamic path values', async () => {
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end('<html><body>Gateway timeout</body></html>');
  });
  const proxy = await createProxyServer(upstream.url);
  const warn = captureProxyWarn();

  try {
    const response = await request(
      `${proxy.url}/opal-fines-service/defendants/QQ123456C/accounts/12345?accountNumber=12345&name=Sensitive`,
      {
        traceparent: `00-${traceId}-${spanId}-01`,
        cookie: 'session=secret',
        authorization: 'Bearer token',
      },
    );

    assert.equal(response.statusCode, 504);
    assertGatewayFailureLog(warn, {
      operationId: traceId,
      method: 'GET',
      path: '/opal-fines-service',
      target: new URL(upstream.url).host,
      statusCode: 504,
      retriable: true,
      errorType: undefined,
      code: undefined,
    });
    assertNoSensitiveLogValues(warn);
  } finally {
    warn.restore();
  }
});
