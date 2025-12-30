/**
 * Hiro API utilities
 *
 * Helper functions for interacting with Hiro APIs with proper error handling.
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
 * Wrapper for fetch that handles Hiro API rate limits
 * Returns the response or throws with a structured error
 */
export async function hiroFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  const rateLimitError = checkHiroRateLimit(response);
  if (rateLimitError) {
    const error = new Error(rateLimitError.error) as Error & { rateLimitError: HiroRateLimitError };
    error.rateLimitError = rateLimitError;
    throw error;
  }

  return response;
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
