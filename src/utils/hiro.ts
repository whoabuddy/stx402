/**
 * Hiro API utilities
 *
 * Helper functions for interacting with Hiro APIs with proper error handling
 * and automatic retry with exponential backoff on rate limits.
 */

export type NetworkType = "mainnet" | "testnet";

/**
 * Get the Hiro API base URL for a network
 */
export function getHiroApiUrl(network: NetworkType): string {
  return network === "mainnet"
    ? "https://api.mainnet.hiro.so"
    : "https://api.testnet.hiro.so";
}

/**
 * Error response for rate limiting
 */
export interface HiroRateLimitError {
  error: string;
  code: "RATE_LIMITED";
  retryAfter: number;
  source: "hiro";
}

/**
 * Configuration options for hiroFetch retry behavior
 */
export interface HiroFetchOptions extends RequestInit {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelay?: number;
}

/**
 * Check if a fetch response is a rate limit error and return structured error
 */
export function checkHiroRateLimit(response: Response): HiroRateLimitError | null {
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    return {
      error: "Hiro API rate limit exceeded",
      code: "RATE_LIMITED",
      retryAfter: retryAfter ? parseInt(retryAfter, 10) : 60,
      source: "hiro",
    };
  }
  return null;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 * Uses the Retry-After header if available, otherwise exponential backoff
 */
function calculateDelay(
  attempt: number,
  retryAfterSeconds: number | null,
  baseDelay: number,
  maxDelay: number
): number {
  if (retryAfterSeconds !== null && retryAfterSeconds > 0) {
    // Use Retry-After header value (convert to ms) with small jitter
    const jitter = Math.random() * 500;
    return Math.min(retryAfterSeconds * 1000 + jitter, maxDelay);
  }

  // Exponential backoff: baseDelay * 2^attempt with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Wrapper for fetch that handles Hiro API rate limits with automatic retry
 *
 * Features:
 * - Automatic retry on 429 (rate limit) responses
 * - Exponential backoff with jitter
 * - Respects Retry-After header when present
 * - Configurable retry count and delays
 *
 * @param url - The URL to fetch
 * @param options - Fetch options plus retry configuration
 * @returns The successful response
 * @throws Error with rateLimitError property if all retries exhausted
 */
export async function hiroFetch(
  url: string,
  options?: HiroFetchOptions
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;

  // Extract standard RequestInit options
  const fetchOptions: RequestInit = { ...options };
  delete (fetchOptions as HiroFetchOptions).maxRetries;
  delete (fetchOptions as HiroFetchOptions).baseDelay;
  delete (fetchOptions as HiroFetchOptions).maxDelay;

  let lastError: (Error & { rateLimitError: HiroRateLimitError }) | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, fetchOptions);

    const rateLimitError = checkHiroRateLimit(response);
    if (!rateLimitError) {
      return response;
    }

    // If this was the last attempt, throw the error
    if (attempt === maxRetries) {
      const error = new Error(
        `${rateLimitError.error} (exhausted ${maxRetries} retries)`
      ) as Error & { rateLimitError: HiroRateLimitError };
      error.rateLimitError = rateLimitError;
      throw error;
    }

    // Calculate delay and wait before retry
    const delay = calculateDelay(
      attempt,
      rateLimitError.retryAfter,
      baseDelay,
      maxDelay
    );

    // Store error in case we need it later
    lastError = new Error(rateLimitError.error) as Error & {
      rateLimitError: HiroRateLimitError;
    };
    lastError.rateLimitError = rateLimitError;

    await sleep(delay);
  }

  // Should not reach here, but just in case
  if (lastError) {
    throw lastError;
  }

  throw new Error("Unexpected error in hiroFetch retry logic");
}

/**
 * Type guard to check if an error is a Hiro rate limit error
 */
export function isHiroRateLimitError(error: unknown): error is Error & { rateLimitError: HiroRateLimitError } {
  return (
    error instanceof Error &&
    "rateLimitError" in error &&
    (error as any).rateLimitError?.code === "RATE_LIMITED"
  );
}
