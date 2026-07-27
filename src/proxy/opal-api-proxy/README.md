# Opal API Proxy Timeout and Retry Contract

`OpalApiProxy` forwards requests from an opal-frontend node server to an upstream API service.
It applies a timeout to the upstream connection, but it never retries a request.
Only the consuming opal-frontend can decide whether replaying its original request is
safe.

## Timeout configuration

`DEFAULT_PROXY_CONFIG.timeoutInMilliseconds` is intentionally `null`. The common node library does not own an
environment-specific proxy timeout value.

Pass the timeout, in milliseconds, as the third argument when creating the
proxy. The consuming application owns this value so it can be configured per
environment.

```ts
const proxyConfiguration: ProxyConfiguration = {
  ...DEFAULT_PROXY_CONFIG,
  opalFinesServiceUrl: config.get('opal-api.opal-fines-service'),
  opalUserServiceUrl: config.get('opal-api.opal-user-service'),
  timeoutInMilliseconds: config.get('opal-api.timeoutInMilliseconds'),
};

if (proxyConfiguration.timeoutInMilliseconds === null) {
  throw new Error('Missing opal-api.timeoutInMilliseconds configuration.');
}

if (proxyConfiguration.opalFinesServiceUrl) {
  app.use(
    '/opal-fines-service',
    OpalApiProxy(proxyConfiguration.opalFinesServiceUrl, ipLoggingEnabled, proxyConfiguration.timeoutInMilliseconds),
  );
}
```

## Error responses

When the upstream service times out or the proxy encounters a recognised
transport failure, the proxy returns the following response:

```json
{
  "title": "Gateway Timeout",
  "status": 504,
  "detail": "The upstream service did not respond in time.",
  "retriable": true
}
```

Other unexpected proxy failures return `502 Bad Gateway` with
`"retriable": false`.

`retriable` is information for the frontend's error and retry handling. It is
not an instruction to replay every request, and the proxy does not replay any
request automatically.

## Frontend retry example

The optional retry support in `opal-frontend-common-ui-lib` must be registered
by the consuming application. A request then opts in individually. This is
appropriate only after the application has decided that replaying the request
is safe, for example a read-only `GET` request.

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { httpRetryInterceptor } from '@hmcts/opal-frontend-common/interceptors/http-retry';

provideHttpClient(withInterceptors([httpRetryInterceptor]));
```

```ts
import { withHttpRetry } from '@hmcts/opal-frontend-common/interceptors/http-retry';

this.http.get('/api/accounts/123', {
  context: withHttpRetry({
    retryCount: 2,
    retryableStatusCodes: [504],
  }),
});
```

Do not opt mutation requests, such as `POST`, `PUT`, `PATCH`, or `DELETE`, into
automatic retries unless the consuming application has explicitly established
that replaying them is safe.
