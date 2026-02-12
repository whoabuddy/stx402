import { BTCtoSats, STXtoMicroSTX, USDCxToMicroUSDCx } from "x402-stacks";

export type TokenType = "STX" | "sBTC" | "USDCx";

// Free endpoints that don't require payment
// These endpoints should NOT have paymentMiddleware applied in index.ts
export const FREE_ENDPOINTS = new Set<string>([
  "/",
  "/health",
  "/docs",
  "/openapi.json",
  "/x402.json",
  "/dashboard",
  "/guide",
  "/toolbox",
  "/registry/list",
  "/admin/registry/pending",
  "/admin/registry/verify",
  "/links/expand/:slug",
  "/agent/registry",
]);

// Pricing tiers for different endpoint categories
export type PricingTier =
  | "simple"
  | "ai"
  | "heavy_ai"
  | "storage_read"
  | "storage_write"
  | "storage_write_large"
  | "storage_ai";

// Amount per tier per token type
export const TIER_AMOUNTS: Record<PricingTier, Record<TokenType, string>> = {
  simple: {
    STX: "0.001",
    sBTC: "0.000001",
    USDCx: "0.001",
  },
  ai: {
    STX: "0.003",
    sBTC: "0.000003",
    USDCx: "0.003",
  },
  heavy_ai: {
    STX: "0.01",
    sBTC: "0.00001",
    USDCx: "0.01",
  },
  // Storage tiers - for stateful KV and Durable Object endpoints
  storage_read: {
    STX: "0.0005",
    sBTC: "0.0000005",
    USDCx: "0.0005",
  },
  storage_write: {
    STX: "0.001",
    sBTC: "0.000001",
    USDCx: "0.001",
  },
  storage_write_large: {
    STX: "0.005",
    sBTC: "0.000005",
    USDCx: "0.005",
  },
  storage_ai: {
    STX: "0.003",
    sBTC: "0.000003",
    USDCx: "0.003",
  },
};

// Endpoint path to pricing tier mapping
// STX402 Directory: ~31 paid endpoints + ~5 free = ~36 total
export const ENDPOINT_TIERS: Record<string, PricingTier> = {
  // === REGISTRY ENDPOINTS (8 paid + 2 free) - X402 Directory ===
  "/registry/probe": "ai",
  "/registry/register": "ai",
  // "/registry/list": free - not in tier list
  "/registry/details": "ai",
  "/registry/update": "ai",
  "/registry/delete": "ai",
  "/registry/my-endpoints": "ai",
  "/registry/transfer": "ai",
  // "/admin/registry/verify": free - admin auth required
  // "/admin/registry/pending": free - admin auth required

  // === LINKS ENDPOINTS (4 paid + 1 free) - URL Shortener ===
  "/links/create": "storage_write",
  // "/links/expand/:slug": free - redirects track clicks
  "/links/stats": "storage_read",
  "/links/delete": "storage_write",
  "/links/list": "storage_read",

  // === AGENT REGISTRY ENDPOINTS (15 paid + 1 free) - ERC-8004 ===
  // Identity Registry
  "/agent/info": "simple",
  "/agent/owner": "simple",
  "/agent/uri": "simple",
  "/agent/metadata": "simple",
  "/agent/version": "simple",
  "/agent/lookup": "simple",
  // Reputation Registry
  "/agent/reputation/summary": "simple",
  "/agent/reputation/feedback": "simple",
  "/agent/reputation/list": "simple",
  "/agent/reputation/clients": "simple",
  "/agent/reputation/auth-hash": "simple",
  // Validation Registry
  "/agent/validation/status": "simple",
  "/agent/validation/summary": "simple",
  "/agent/validation/list": "simple",
  "/agent/validation/requests": "simple",
  // Note: /agent/registry is free - not in tier list
};

// Check if a path is a free endpoint (no payment required)
export function isFreeEndpoint(path: string): boolean {
  // Check exact match first
  if (FREE_ENDPOINTS.has(path)) {
    return true;
  }

  // Check pattern match for parameterized routes (e.g., /links/expand/:slug)
  for (const freePattern of FREE_ENDPOINTS) {
    if (freePattern.includes(":")) {
      // Convert pattern to regex (e.g., /links/expand/:slug -> /links/expand/[^/]+)
      const regexPattern = "^" + freePattern.replace(/:[^/]+/g, "[^/]+") + "$";
      if (new RegExp(regexPattern).test(path)) {
        return true;
      }
    }
  }

  return false;
}

// Get pricing tier for an endpoint path (strips path params like :address)
export function getEndpointTier(path: string): PricingTier {
  // Normalize path by removing path parameters
  const normalizedPath = path.replace(/\/:[^/]+/g, "").replace(/\/[^/]+$/, (match) => {
    // Keep the last segment if it's not a dynamic param indicator
    return match.startsWith("/:") ? "" : match;
  });

  // Try exact match first
  if (ENDPOINT_TIERS[path]) {
    return ENDPOINT_TIERS[path];
  }

  // Try normalized path
  if (ENDPOINT_TIERS[normalizedPath]) {
    return ENDPOINT_TIERS[normalizedPath];
  }

  // Try matching by prefix (for paths with params like /api/util/ip-lookup/:ip)
  for (const [endpoint, tier] of Object.entries(ENDPOINT_TIERS)) {
    if (path.startsWith(endpoint)) {
      return tier;
    }
  }

  // Default to simple tier
  return "simple";
}

// Get payment amount for a specific endpoint path
export function getPaymentAmountForPath(
  path: string,
  tokenType: TokenType
): bigint {
  const tier = getEndpointTier(path);
  const amountStr = TIER_AMOUNTS[tier][tokenType];
  return convertToSmallestUnit(amountStr, tokenType);
}

// Convert amount string to smallest unit (microSTX, sats, microUSDCx)
function convertToSmallestUnit(amountStr: string, tokenType: TokenType): bigint {
  const amountNum = parseFloat(amountStr);
  switch (tokenType) {
    case "STX":
      return STXtoMicroSTX(amountStr);
    case "sBTC":
      return BTCtoSats(amountNum);
    case "USDCx":
      return USDCxToMicroUSDCx(amountStr);
    default:
      throw new Error(`Unknown tokenType: ${tokenType}`);
  }
}

export function validateTokenType(tokenTypeStr: string): TokenType {
  const upper = tokenTypeStr.toUpperCase();
  const validMap: Record<string, TokenType> = {
    STX: "STX",
    SBTC: "sBTC",
    USDCX: "USDCx",
  };
  const validTokens: TokenType[] = ["STX", "sBTC", "USDCx"];
  if (validMap[upper]) {
    return validMap[upper];
  }
  throw new Error(
    `Invalid tokenType: ${tokenTypeStr}. Supported: ${validTokens.join(", ")}`
  );
}
