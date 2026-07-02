/**
 * Describes how long to wait before retrying an operation.
 *
 * The helper supports either a fixed delay or a per-attempt delay function so callers can keep simple policies
 * simple while still allowing backoff when needed.
 */
export type RetryDelay = number | ((attempt: number) => number);

/**
 * Options for running an async operation with a bounded retry policy.
 */
export interface BoundedRetryOptions {
  maxAttempts: number;
  delayMs: RetryDelay;
  shouldRetry: (error: unknown, attempt: number) => boolean;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getRetryDelay(delayMs: RetryDelay, attempt: number): number {
  return typeof delayMs === 'function' ? delayMs(attempt) : delayMs;
}

/**
 * Runs an async operation with a bounded retry policy.
 *
 * The first attempt happens immediately. Later attempts only run when `shouldRetry` returns true for the error
 * raised by the previous attempt, and the helper stops once `maxAttempts` has been reached.
 *
 * @param operation - Async work to run.
 * @param options - Retry limit, delay policy, and retryability check.
 * @returns The successful result from `operation`.
 * @throws The last error raised by `operation` when retries are exhausted or the error is not retryable.
 */
export async function withBoundedRetry<T>(operation: () => Promise<T>, options: BoundedRetryOptions): Promise<T> {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new RangeError('maxAttempts must be an integer greater than 0');
  }

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      const shouldRetry = options.shouldRetry(error, attempt);

      if (!shouldRetry || attempt === options.maxAttempts) {
        throw error;
      }

      const delay = getRetryDelay(options.delayMs, attempt);

      if (delay > 0) {
        await wait(delay);
      }
    }
  }

  throw new Error('Retry helper exited without returning or throwing');
}
