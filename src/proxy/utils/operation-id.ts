import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import * as appInsights from 'applicationinsights';

type HeaderValue = string | string[] | undefined;

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i;
const REQUEST_ID_PATTERN = /^\|([^.\s]+)\./;

function firstHeaderValue(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value;
}

function getActiveAppInsightsOperationId(): string | undefined {
  return appInsights.getCorrelationContext()?.operation?.id;
}

/**
 * Resolves the operation id used to correlate proxy failures across logs, dependencies, and frontend errors.
 */
export function resolveOperationId(
  req: { headers: IncomingHttpHeaders },
  activeOperationId = getActiveAppInsightsOperationId(),
): string {
  if (activeOperationId) {
    return activeOperationId;
  }

  const traceParent = firstHeaderValue(req.headers['traceparent']);
  const traceParentMatch = traceParent ? TRACEPARENT_PATTERN.exec(traceParent) : null;
  if (traceParentMatch?.[1]) {
    return traceParentMatch[1];
  }

  const requestId = firstHeaderValue(req.headers['request-id']);
  const requestIdMatch = requestId ? REQUEST_ID_PATTERN.exec(requestId) : null;
  if (requestIdMatch?.[1]) {
    return requestIdMatch[1];
  }

  return crypto.randomUUID();
}
