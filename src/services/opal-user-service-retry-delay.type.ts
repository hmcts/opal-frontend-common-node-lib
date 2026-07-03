/**
 * Describes how long to wait before retrying an operation.
 *
 * The helper supports either a fixed delay or a per-attempt delay function so callers can keep simple policies
 * simple while still allowing backoff when needed.
 */
export type RetryDelay = number | ((attempt: number) => number);
