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
  method: "GET" | "POST" | "DELETE";
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
  method: "GET" | "POST" | "DELETE",
  tier: PricingTier
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
// Endpoint Descriptions (for static generation without OpenAPI fetch)
// =============================================================================

const ENDPOINT_DESCRIPTIONS: Record<string, { method: "GET" | "POST"; description: string }> = {
  // Registry endpoints
  "/registry/probe": { method: "POST", description: "Probe an x402 endpoint to discover payment requirements" },
  "/registry/register": { method: "POST", description: "Register a new x402 endpoint in the directory" },
  "/registry/details": { method: "POST", description: "Get details for a registered endpoint" },
  "/registry/update": { method: "POST", description: "Update an endpoint you own" },
  "/registry/delete": { method: "POST", description: "Delete an endpoint you own" },
  "/registry/my-endpoints": { method: "POST", description: "List endpoints registered by your address" },
  "/registry/transfer": { method: "POST", description: "Transfer endpoint ownership to another address" },

  // Links endpoints
  "/links/create": { method: "POST", description: "Create a shortened URL with tracking" },
  "/links/stats": { method: "POST", description: "Get click statistics for a shortened URL" },
  "/links/delete": { method: "POST", description: "Delete a shortened URL you own" },
  "/links/list": { method: "GET", description: "List all your shortened URLs" },

  // Agent Identity endpoints
  "/agent/info": { method: "POST", description: "Get agent information by ID" },
  "/agent/owner": { method: "GET", description: "Get the owner address of an agent" },
  "/agent/uri": { method: "GET", description: "Get the metadata URI for an agent" },
  "/agent/metadata": { method: "POST", description: "Get specific metadata value for an agent" },
  "/agent/version": { method: "GET", description: "Get the agent registry contract version" },
  "/agent/lookup": { method: "POST", description: "Find agents owned by an address" },

  // Agent Reputation endpoints
  "/agent/reputation/summary": { method: "POST", description: "Get reputation summary for an agent" },
  "/agent/reputation/feedback": { method: "POST", description: "Get specific feedback entry for an agent" },
  "/agent/reputation/list": { method: "POST", description: "List all feedback for an agent" },
  "/agent/reputation/clients": { method: "POST", description: "List clients who provided feedback" },
  "/agent/reputation/auth-hash": { method: "POST", description: "Generate auth hash for submitting feedback" },

  // Agent Validation endpoints
  "/agent/validation/status": { method: "POST", description: "Get validation request status" },
  "/agent/validation/summary": { method: "POST", description: "Get validation summary for an agent" },
  "/agent/validation/list": { method: "POST", description: "List validations for an agent" },
  "/agent/validation/requests": { method: "POST", description: "List pending validation requests" },
};

// =============================================================================
// Main Generator
// =============================================================================

export interface GeneratorConfig {
  network: "mainnet" | "testnet";
  payTo: string;
  name?: string;
  image?: string;
}

/**
 * Generate x402.json schema from OpenAPI spec
 */
export function generateX402Schema(
  openapi: OpenAPISpec,
  config: GeneratorConfig
): X402Schema {
  const accepts: X402Entry[] = [];

  // Process each path in OpenAPI spec
  for (const [path, methods] of Object.entries(openapi.paths)) {
    // Check if this is a paid endpoint
    const tier = ENDPOINT_TIERS[path];
    if (!tier) continue; // Skip free endpoints

    for (const [method, operation] of Object.entries(methods)) {
      if (method === "options" || method === "head") continue;

      const httpMethod = method.toUpperCase() as "GET" | "POST";
      const description = cleanDescription(operation.summary);
      const timeout = getTimeoutForTier(tier);

      // Build input schema
      const bodyFields = extractBodyFields(operation.requestBody);
      const input: X402InputSchema = {
        type: "http",
        method: httpMethod,
      };
      if (httpMethod === "POST" && bodyFields) {
        input.bodyType = "json";
        input.bodyFields = bodyFields;
      }

      // Build output schema
      const output = extractOutputSchema(operation.responses);

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
          description,
          mimeType: "application/json",
          outputSchema: { input, output },
        });
      }
    }
  }

  return {
    x402Version: 1,
    name: config.name || "stx402 Directory",
    image: config.image || "https://stx402.com/favicon.svg",
    accepts,
  };
}

/**
 * Generate x402.json from env bindings (for runtime endpoint)
 */
export async function generateX402SchemaFromUrl(
  baseUrl: string,
  config: Partial<GeneratorConfig>
): Promise<X402Schema> {
  // Fetch OpenAPI spec from the server
  const response = await fetch(`${baseUrl}/openapi.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
  }

  const openapi = (await response.json()) as OpenAPISpec;

  // Use defaults for missing config
  const fullConfig: GeneratorConfig = {
    network: config.network || "mainnet",
    payTo: config.payTo || "",
    name: config.name,
    image: config.image,
  };

  if (!fullConfig.payTo) {
    throw new Error("payTo address is required");
  }

  return generateX402Schema(openapi, fullConfig);
}

/**
 * Generate x402.json statically without fetching OpenAPI
 * Uses hardcoded endpoint descriptions - no network calls needed
 */
export function generateX402SchemaStatic(config: GeneratorConfig): X402Schema {
  const accepts: X402Entry[] = [];

  // Process each paid endpoint from ENDPOINT_TIERS
  for (const [path, tier] of Object.entries(ENDPOINT_TIERS)) {
    const endpointInfo = ENDPOINT_DESCRIPTIONS[path];
    if (!endpointInfo) continue; // Skip if no description defined

    const timeout = getTimeoutForTier(tier);

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
        description: endpointInfo.description,
        mimeType: "application/json",
        outputSchema: {
          input: {
            type: "http",
            method: endpointInfo.method,
          },
          output: {},
        },
      });
    }
  }

  return {
    x402Version: 1,
    name: config.name || "stx402 Directory",
    image: config.image || "https://stx402.com/favicon.svg",
    accepts,
  };
}
