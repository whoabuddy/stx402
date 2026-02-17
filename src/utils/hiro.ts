/**
 * Hiro API utilities
 *
 * Helper functions for interacting with Hiro APIs with proper error handling
 * and automatic retry with exponential backoff on rate limits.
 */

import { withRetry } from "./retry";

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
 * Check if a response is a rate limit error (for withRetry)
 */
function isHiroRateLimitResponse(response: Response): boolean {
  return response.status === 429;
}

/**
 * Parse retry delay from Hiro rate limit response
 */
function parseHiroRetryDelay(response: Response): number | null {
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      return parseInt(retryAfter, 10);
    }
  }
  return null;
}

/**
 * Wrapper for fetch that handles Hiro API rate limits with automatic retry.
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
  // Extract standard RequestInit options
  const fetchOptions: RequestInit = { ...options };
  delete (fetchOptions as HiroFetchOptions).maxRetries;
  delete (fetchOptions as HiroFetchOptions).baseDelay;
  delete (fetchOptions as HiroFetchOptions).maxDelay;

  // Use withRetry but we need to handle Response objects, not errors
  // So we use a custom pattern here
  return withRetry(
    async () => {
      const response = await fetch(url, fetchOptions);

      const rateLimitError = checkHiroRateLimit(response);
      if (rateLimitError) {
        // Throw an error so withRetry can catch it
        const error = new Error(rateLimitError.error) as Error & {
          rateLimitError: HiroRateLimitError;
        };
        error.rateLimitError = rateLimitError;
        throw error;
      }

      return response;
    },
    options,
    (error: unknown) => {
      // Check if this is our rate limit error
      return (
        error !== null &&
        typeof error === "object" &&
        "rateLimitError" in error
      );
    },
    (error: unknown) => {
      // Extract retry delay from our custom error
      if (
        error !== null &&
        typeof error === "object" &&
        "rateLimitError" in error
      ) {
        const rateLimitError = (error as { rateLimitError: HiroRateLimitError })
          .rateLimitError;
        return rateLimitError.retryAfter;
      }
      return null;
    }
  );
}

