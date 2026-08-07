import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, test } from 'node:test';
import express from 'express';
import opalApiProxy, { createSafeProxyLogMetadata, resolveOperationId } from '../../dist/proxy/opal-api-proxy/index.js';

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

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

test('resolveOperationId uses active App Insights context before request headers', () => {
  const operationId = resolveOperationId(
    {
      headers: {
        traceparent: `00-${traceId}-${spanId}-01`,
      },
    },
    'active-operation-id',
  );

  assert.equal(operationId, 'active-operation-id');
});

test('resolveOperationId reads operation id from traceparent', () => {
  const operationId = resolveOperationId(
    {
      headers: {
        traceparent: `00-${traceId}-${spanId}-01`,
      },
    },
    undefined,
  );

  assert.equal(operationId, traceId);
});

test('resolveOperationId reads operation id from request-id', () => {
  const operationId = resolveOperationId(
    {
      headers: {
        'request-id': `|${traceId}.${spanId}.`,
      },
    },
    undefined,
  );

  assert.equal(operationId, traceId);
});

test('resolveOperationId generates a fallback id', () => {
  const operationId = resolveOperationId({ headers: {} }, undefined);

  assert.match(operationId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('proxy timeout returns OPAL problem JSON with operation id', async () => {
  const upstream = await listen(() => undefined);
  const proxy = await createProxyServer(upstream.url, 30);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    traceparent: `00-${traceId}-${spanId}-01`,
  });

  assert.equal(response.statusCode, 504);
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.equal(response.headers['content-length'], Buffer.byteLength(response.body).toString());
  assert.notEqual(response.body, '');
  assert.deepEqual(JSON.parse(response.body), {
    title: 'There was a problem',
    status: 504,
    detail: 'You can try again. If the problem persists, contact the service desk.',
    retriable: true,
    operation_id: traceId,
  });
});

test('gateway HTML 504 is normalised and response digest is removed', async () => {
  const html = '<html><body>Gateway timeout</body></html>';
  const upstream = await listen((_req, res) => {
    res.writeHead(504, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Digest': sha512ContentDigest(html),
    });
    res.end(html);
  });
  const proxy = await createProxyServer(upstream.url);

  const response = await request(`${proxy.url}/opal-fines-service/minor-creditors`, {
    traceparent: `00-${traceId}-${spanId}-01`,
  });

  assert.equal(response.statusCode, 504);
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.equal(response.headers['content-digest'], undefined);
  assert.deepEqual(JSON.parse(response.body), {
    title: 'There was a problem',
    status: 504,
    detail: 'You can try again. If the problem persists, contact the service desk.',
    retriable: true,
    operation_id: traceId,
  });
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
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.equal(response.headers['content-length'], Buffer.byteLength(response.body).toString());
  assert.deepEqual(JSON.parse(response.body), {
    title: 'There was a problem',
    status: 504,
    detail: 'You can try again. If the problem persists, contact the service desk.',
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

test('safe logging metadata includes operation id and excludes sensitive data', () => {
  const metadata = createSafeProxyLogMetadata(
    {
      method: 'POST',
      path: '/minor-creditors/search',
      url: '/minor-creditors/search?accountNumber=12345',
      headers: {
        cookie: 'session=secret',
        authorization: 'Bearer token',
      },
      body: {
        nationalInsuranceNumber: 'QQ123456C',
      },
    },
    'https://fines.example.test/service?token=secret',
    traceId,
    504,
    true,
    123,
    Object.assign(new Error('socket timeout with token'), { code: 'ETIMEDOUT' }),
  );

  assert.deepEqual(metadata, {
    operationId: traceId,
    method: 'POST',
    path: '/minor-creditors/search',
    target: 'fines.example.test',
    statusCode: 504,
    elapsedMs: 123,
    retriable: true,
    errorType: 'Error',
    code: 'ETIMEDOUT',
  });
  assert.doesNotMatch(JSON.stringify(metadata), /secret|Bearer|QQ123456C|accountNumber|socket timeout/);
});
