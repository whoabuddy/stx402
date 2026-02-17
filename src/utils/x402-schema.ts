/**
 * X402 Manifest Generator (V2 Protocol)
 *
 * Generates x402.json discovery manifest for Bazaar/scanner registration.
 * Static generation without network calls (Cloudflare Workers can't self-fetch).
 *
 * V2 format: per-endpoint items[] with CAIP-2 network IDs, resource objects,
 * service metadata, ISO lastUpdated, and Bazaar extensions.
 */

import {
  ENDPOINT_TIERS,
  TIER_AMOUNTS,
  convertToSmallestUnit,
  type PricingTier,
  type TokenType,
} from "./pricing";
import { getEndpointMetadata, buildBazaarExtension } from "../bazaar";
import type { BazaarExtension } from "../bazaar";

// =============================================================================
// V2 Manifest Types
// =============================================================================

/**
 * V2 payment requirements (per-network, per-token accept entry)
 */
export interface V2PaymentRequirements {
  scheme: "exact";
  network: string; // CAIP-2 format: "stacks:1" or "stacks:2147483648"
  amount: string; // Required payment amount in atomic/smallest units
  asset: TokenType;
  payTo: string;
  facilitatorUrl?: string;
  description?: string;
}

/**
 * Resource information (V2 protocol compatible)
 */
export interface V2ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

/**
 * V2 manifest item (per-endpoint grouping)
 */
export interface V2ManifestItem {
  resource: V2ResourceInfo;
  paymentRequirements: V2PaymentRequirements[];
  extensions?: {
    bazaar?: BazaarExtension["bazaar"];
  };
}

/**
 * V2 service metadata
 */
export interface V2ServiceInfo {
  name: string;
  description: string;
  url: string;
}

/**
 * V2 manifest (top-level discovery response)
 */
export interface V2Manifest {
  version: "2.0";
  service: V2ServiceInfo;
  lastUpdated: string; // ISO 8601 timestamp
  items: V2ManifestItem[];
}

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  network: "mainnet" | "testnet";
  payTo: string;
  baseUrl: string; // e.g., "https://stx402.com"
  facilitatorUrl?: string;
}

// =============================================================================
// Helpers
// =============================================================================

const TOKENS: TokenType[] = ["STX", "sBTC", "USDCx"];

/**
 * Convert network name to CAIP-2 chain ID format.
 * @see https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
 */
function getCAIP2Network(network: "mainnet" | "testnet"): string {
  return network === "mainnet" ? "stacks:1" : "stacks:2147483648";
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate V2 x402 discovery manifest.
 *
 * Produces per-endpoint grouped manifest with CAIP-2 network IDs, resource
 * objects, service metadata, ISO lastUpdated timestamp, and Bazaar extensions.
 * Iterates ENDPOINT_TIERS map — no hardcoded registry array needed.
 *
 * @param config - Generator configuration including baseUrl, payTo, network
 * @returns V2Manifest with items[] array (one item per paid endpoint)
 */
export function generateX402Manifest(config: GeneratorConfig): V2Manifest {
  const items: V2ManifestItem[] = [];
  const caip2Network = getCAIP2Network(config.network);

  for (const [path, tier] of Object.entries(ENDPOINT_TIERS)) {
    // Get metadata from Bazaar registry — skip endpoints with no metadata
    const metadata = getEndpointMetadata(path);
    if (!metadata) continue;

    const paymentRequirements: V2PaymentRequirements[] = [];

    // Build one payment requirement per supported token
    for (const token of TOKENS) {
      const tierAmounts = TIER_AMOUNTS[tier as PricingTier];
      const amount = String(convertToSmallestUnit(tierAmounts[token], token));

      const req: V2PaymentRequirements = {
        scheme: "exact",
        network: caip2Network,
        amount,
        asset: token,
        payTo: config.payTo,
      };

      if (config.facilitatorUrl) {
        req.facilitatorUrl = config.facilitatorUrl;
      }

      if (metadata.description) {
        req.description = metadata.description;
      }

      paymentRequirements.push(req);
    }

    // Skip endpoint if no valid payment options
    if (paymentRequirements.length === 0) continue;

    // Build the manifest item
    const item: V2ManifestItem = {
      resource: {
        url: `${config.baseUrl}${path}`,
        description: metadata.description,
        mimeType: "application/json",
      },
      paymentRequirements,
      extensions: {
        bazaar: buildBazaarExtension(metadata).bazaar,
      },
    };

    items.push(item);
  }

  return {
    version: "2.0",
    service: {
      name: "stx402 Directory",
      description: "Meta layer for X402 ecosystem — endpoint discovery and agent identity on Stacks",
      url: config.baseUrl,
    },
    lastUpdated: new Date().toISOString(),
    items,
  };
}
