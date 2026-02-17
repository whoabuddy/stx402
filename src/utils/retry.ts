/**
 * Retry utilities for handling rate limits and transient errors.
 *
 * Provides exponential backoff with jitter for automatic retry on rate limit errors.
 */

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default rate limit error detector - checks for common rate limit patterns
 */
function defaultIsRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests");
  }
  return false;
}

/**
 * Default retry delay parser - tries to extract numeric delay from error message
 */
function defaultParseRetryDelay(error: unknown): number | null {
  if (error instanceof Error) {
    const match = error.message.match(/try again in (\d+) seconds?/i);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Calculate delay with exponential backoff and jitter.
 * Uses the parsed retry delay if available, otherwise exponential backoff.
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param retryDelaySeconds - Suggested delay from error message (in seconds)
 * @param baseDelay - Base delay in milliseconds for exponential backoff
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
function calculateDelay(
  attempt: number,
  retryDelaySeconds: number | null,
  baseDelay: number,
  maxDelay: number
): number {
  if (retryDelaySeconds !== null && retryDelaySeconds > 0) {
    // Use suggested delay (convert to ms) with small jitter
    const jitter = Math.random() * 500;
    return Math.min(retryDelaySeconds * 1000 + jitter, maxDelay);
  }

  // Exponential backoff: baseDelay * 2^attempt with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Retry a function with exponential backoff on rate limit errors.
 *
 * Features:
 * - Automatic retry on rate limit errors
 * - Exponential backoff with jitter
 * - Respects suggested retry delay from error messages
 * - Configurable retry count and delays
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration (maxRetries, baseDelay, maxDelay)
 * @param isRateLimitError - Function to check if error should trigger retry (default: checks for 429/rate limit)
 * @param parseRetryDelay - Function to extract delay in seconds from error (default: parses "try again in N seconds")
 * @returns Result of fn on success
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  },
  isRateLimitError: (error: unknown) => boolean = defaultIsRateLimitError,
  parseRetryDelay: (error: unknown) => number | null = defaultParseRetryDelay
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Check if this is a rate limit error
      if (!isRateLimitError(error)) {
        throw error; // Not a rate limit, rethrow immediately
      }

      // If this was the last attempt, rethrow
      if (attempt === maxRetries) {
        throw error;
      }

      // Parse retry delay from error message or use exponential backoff
      const retryDelaySeconds = parseRetryDelay(error);
      const delay = calculateDelay(attempt, retryDelaySeconds, baseDelay, maxDelay);

      // Store error in case we need it later
      lastError = error;

      await sleep(delay);
    }
  }

  // Should not reach here, but throw the last error just in case
  if (lastError) {
    throw lastError;
  }

  throw new Error("Unexpected error in withRetry logic");
}
