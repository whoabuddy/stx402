/**
 * X402 Schema Generator
 *
 * Generates x402.json format for StacksX402 scanner discovery.
 * Static generation without network calls (Cloudflare Workers can't self-fetch).
 *
 * V2 format includes Bazaar-compatible metadata with:
 * - Full input/output examples
 * - JSON schemas per endpoint
 * - Rich discovery metadata from the registry
 */

import {
  ENDPOINT_TIERS,
  TIER_AMOUNTS,
  type PricingTier,
  type TokenType,
} from "./pricing";
import { getEndpointMetadata } from "../bazaar";
import type { EndpointMetadata } from "../bazaar";

// =============================================================================
// Types
// =============================================================================

export interface X402Entry {
  scheme: "exact";
  network: "stacks";
  asset: TokenType;
  payTo: string;
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
  resource: string;
  description: string;
  mimeType: "application/json";
  outputSchema: {
    input: X402InputSchema;
    output: X402OutputSchema;
  };
}

export interface X402InputSchema {
  type: "http";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  bodyType?: "json" | "form" | "text" | "binary";
  bodySchema?: Record<string, unknown>; // Full JSON Schema
  queryParams?: Record<string, unknown>; // Query parameter schema
}

export interface X402OutputSchema {
  type: "json";
  example: Record<string, unknown>; // Realistic output example
  schema?: Record<string, unknown>; // Full JSON Schema (optional)
}

export interface X402Schema {
  x402Version: 2; // V2 includes Bazaar metadata
  name: string;
  image: string;
  accepts: X402Entry[];
}

export interface GeneratorConfig {
  network: "mainnet" | "testnet";
  payTo: string;
  name?: string;
  image?: string;
}

// =============================================================================
// Conversion Helpers
// =============================================================================

const TOKENS: TokenType[] = ["STX", "sBTC", "USDCx"];

/**
 * Convert human-readable amount to smallest unit
 */
function toSmallestUnit(amountStr: string, token: TokenType): string {
  const amount = parseFloat(amountStr);
  switch (token) {
    case "STX":
      return String(Math.round(amount * 1_000_000)); // microSTX
    case "sBTC":
      return String(Math.round(amount * 100_000_000)); // sats
    case "USDCx":
      return String(Math.round(amount * 1_000_000)); // microUSDCx
    default:
      return String(Math.round(amount * 1_000_000));
  }
}

/**
 * Get timeout based on tier complexity
 */
function getTimeoutForTier(tier: PricingTier): number {
  switch (tier) {
    case "heavy_ai":
    case "storage_ai":
      return 120;
    case "ai":
      return 90;
    default:
      return 60;
  }
}

/**
 * Build rich input/output schema from Bazaar metadata
 */
function buildOutputSchema(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
): { input: X402InputSchema; output: X402OutputSchema } {
  // Lookup metadata in Bazaar registry
  const metadata = getEndpointMetadata(path, method);

  // Build input schema
  const input: X402InputSchema = {
    type: "http",
    method: method,
  };

  // Add rich metadata if available
  if (metadata) {
    if (metadata.bodyType) {
      input.bodyType = metadata.bodyType;
    }
    if (metadata.bodySchema) {
      input.bodySchema = metadata.bodySchema;
    }
    if (metadata.queryParams) {
      input.queryParams = metadata.queryParams;
    }
  }

  // Build output schema
  const output: X402OutputSchema = {
    type: "json",
    example: metadata?.outputExample || {},
  };

  // Add output schema if available
  if (metadata?.outputSchema) {
    output.schema = metadata.outputSchema;
  }

  return { input, output };
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate x402.json statically without fetching OpenAPI (v2 format)
 * Uses Bazaar metadata registry - no network calls needed
 */
export function generateX402SchemaStatic(config: GeneratorConfig): X402Schema {
  const accepts: X402Entry[] = [];

  // Process each paid endpoint from ENDPOINT_TIERS
  for (const [path, tier] of Object.entries(ENDPOINT_TIERS)) {
    // Get metadata from Bazaar registry
    const metadata = getEndpointMetadata(path);
    if (!metadata) continue; // Skip if no metadata defined

    const method = metadata.method;
    const timeout = getTimeoutForTier(tier);

    // Build rich input/output schemas from Bazaar metadata
    const outputSchema = buildOutputSchema(path, method);

    // Create entry for each supported token
    for (const token of TOKENS) {
      const tierAmounts = TIER_AMOUNTS[tier];
      const amount = toSmallestUnit(tierAmounts[token], token);

      accepts.push({
        scheme: "exact",
        network: "stacks",
        asset: token,
        payTo: config.payTo,
        maxAmountRequired: amount,
        maxTimeoutSeconds: timeout,
        resource: path,
        description: metadata.description,
        mimeType: "application/json",
        outputSchema,
      });
    }
  }

  return {
    x402Version: 2,
    name: config.name || "stx402 Directory",
    image: config.image || "https://stx402.com/favicon.svg",
    accepts,
  };
}
