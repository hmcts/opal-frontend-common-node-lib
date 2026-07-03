import type { RetryDelay } from './opal-user-service-retry-delay.type.js';

/**
 * Options for running an async operation with a bounded retry policy.
 */
export interface BoundedRetryOptions {
  maxAttempts: number;
  delayMs: RetryDelay;
  shouldRetry: (error: unknown, attempt: number) => boolean;
}
