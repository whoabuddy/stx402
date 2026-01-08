import { BTCtoSats, STXtoMicroSTX, USDCxToMicroUSDCx } from "x402-stacks";

export type TokenType = "STX" | "sBTC" | "USDCx";

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
// ~90 paid endpoints + ~7 free = ~97 total
export const ENDPOINT_TIERS: Record<string, PricingTier> = {
  // === STACKS ENDPOINTS (7) ===
  // Clarity utilities
  "/api/stacks/convert-address": "simple",
  "/api/stacks/decode-clarity-hex": "simple",
  "/api/stacks/to-consensus-buff": "simple",
  "/api/stacks/from-consensus-buff": "simple",
  "/api/stacks/decode-tx": "simple",
  // Aggregated endpoints
  "/api/stacks/profile": "ai", // Multiple API calls
  "/api/stacks/contract-info": "simple", // Cacheable

  // === sBTC ENDPOINTS (1) ===
  "/api/sbtc/treasury": "ai", // Multiple API calls + intelligence

  // === AI ENDPOINTS (13) ===
  "/api/ai/dad-joke": "ai",
  "/api/ai/summarize": "ai",
  "/api/ai/image-describe": "heavy_ai",
  "/api/ai/tts": "heavy_ai",
  "/api/ai/generate-image": "heavy_ai",
  "/api/ai/explain-contract": "ai",
  "/api/ai/translate": "ai",
  "/api/ai/sentiment": "ai",
  "/api/ai/keywords": "ai",
  "/api/ai/language-detect": "ai",
  "/api/ai/paraphrase": "ai",
  "/api/ai/grammar-check": "ai",
  "/api/ai/question-answer": "ai",

  // === HASH ENDPOINTS (6) ===
  "/api/hash/sha256": "simple",
  "/api/hash/sha512": "simple",
  "/api/hash/keccak256": "simple",
  "/api/hash/hash160": "simple",
  "/api/hash/ripemd160": "simple",
  "/api/hash/hmac": "simple",

  // === UTILITY ENDPOINTS (2) ===
  "/api/util/qr-generate": "simple",
  "/api/util/verify-signature": "simple",

  // === REGISTRY ENDPOINTS (9 paid + 1 free) ===
  "/api/registry/probe": "ai",
  "/api/registry/register": "ai",
  // "/api/registry/list": free - not in tier list
  "/api/registry/details": "ai",
  "/api/registry/update": "ai",
  "/api/registry/delete": "ai",
  "/api/registry/my-endpoints": "ai",
  "/api/registry/transfer": "ai",
  "/api/admin/registry/verify": "ai",
  "/api/admin/registry/pending": "ai",

  // === KV STORAGE ENDPOINTS (4) ===
  "/api/kv/set": "storage_write",
  "/api/kv/get": "storage_read",
  "/api/kv/delete": "storage_write",
  "/api/kv/list": "storage_read",

  // === PASTE ENDPOINTS (3) ===
  "/api/paste/create": "storage_write",
  "/api/paste": "storage_read", // GET /api/paste/:code
  "/api/paste/delete": "storage_write",

  // === COUNTER ENDPOINTS (6) - Durable Objects ===
  "/api/counter/increment": "storage_write",
  "/api/counter/decrement": "storage_write",
  "/api/counter/get": "storage_read",
  "/api/counter/reset": "storage_write",
  "/api/counter/list": "storage_read",
  "/api/counter/delete": "storage_write",

  // === SQL ENDPOINTS (3) - Durable Objects ===
  "/api/sql/query": "storage_read",
  "/api/sql/execute": "storage_write",
  "/api/sql/schema": "storage_read",

  // === LINKS ENDPOINTS (4 paid + 1 free) - Durable Objects URL Shortener ===
  "/api/links/create": "storage_write",
  // "/api/links/expand/:slug": free - redirects track clicks
  "/api/links/stats": "storage_read",
  "/api/links/delete": "storage_write",
  "/api/links/list": "storage_read",

  // === SYNC ENDPOINTS (5 paid) - Durable Objects Distributed Locks ===
  "/api/sync/lock": "storage_write",
  "/api/sync/unlock": "storage_write",
  "/api/sync/check": "storage_read",
  "/api/sync/extend": "storage_write",
  "/api/sync/list": "storage_read",

  // === QUEUE ENDPOINTS (5 paid) - Durable Objects Job Queue ===
  "/api/queue/push": "storage_write",
  "/api/queue/pop": "storage_write",
  "/api/queue/complete": "storage_write",
  "/api/queue/fail": "storage_write",
  "/api/queue/status": "storage_read",

  // === MEMORY ENDPOINTS (5 paid) - Durable Objects Agent Memory ===
  "/api/memory/store": "storage_ai",
  "/api/memory/recall": "storage_read",
  "/api/memory/search": "storage_ai",
  "/api/memory/list": "storage_read",
  "/api/memory/forget": "storage_write",

  // === AGENT REGISTRY ENDPOINTS (15 paid + 1 free) - ERC-8004 ===
  // Identity Registry
  "/api/agent/info": "simple",
  "/api/agent/owner": "simple",
  "/api/agent/uri": "simple",
  "/api/agent/metadata": "simple",
  "/api/agent/version": "simple",
  "/api/agent/lookup": "simple",
  // Reputation Registry
  "/api/agent/reputation/summary": "simple",
  "/api/agent/reputation/feedback": "simple",
  "/api/agent/reputation/list": "simple",
  "/api/agent/reputation/clients": "simple",
  "/api/agent/reputation/auth-hash": "simple",
  // Validation Registry
  "/api/agent/validation/status": "simple",
  "/api/agent/validation/summary": "simple",
  "/api/agent/validation/list": "simple",
  "/api/agent/validation/requests": "simple",
  // Note: /api/agent/registry is free - not in tier list
};

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

// Legacy: Keep DEFAULT_AMOUNTS for backwards compatibility
export const DEFAULT_AMOUNTS: Record<TokenType, string> = TIER_AMOUNTS.simple;

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

export function getPaymentAmount(tokenType: TokenType): bigint {
  const amountStr = DEFAULT_AMOUNTS[tokenType];
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
