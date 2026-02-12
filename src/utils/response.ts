import type { AppContext } from "../types";
import type { TokenType } from "./pricing";

/**
 * Create a standardized chainable response.
 * Use this for all new endpoints to ensure consistent output format.
 *
 * @param c - Hono context
 * @param result - Primary result value (will be in `result` field)
 * @param tokenType - Token type used for payment
 * @param metadata - Optional metadata about processing
 * @returns JSON response with chainable format
 *
 * @example
 * // Simple string result
 * return chainableResponse(c, "SGVsbG8gV29ybGQ=", tokenType);
 *
 * @example
 * // With metadata
 * return chainableResponse(c, encodedString, tokenType, {
 *   inputLength: input.length,
 *   outputLength: encodedString.length,
 *   processingTimeMs: Date.now() - start,
 * });
 */
export function chainableResponse<T>(
  c: AppContext,
  result: T,
  tokenType: TokenType,
  metadata?: {
    processingTimeMs?: number;
    inputLength?: number;
    outputLength?: number;
    model?: string;
    tier?: string;
    [key: string]: unknown;
  }
): Response {
  const response: {
    result: T;
    tokenType: TokenType;
    metadata?: typeof metadata;
  } = {
    result,
    tokenType,
  };

  if (metadata && Object.keys(metadata).length > 0) {
    response.metadata = metadata;
  }

  return c.json(response);
}
