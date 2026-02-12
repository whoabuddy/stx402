/**
 * Bazaar Endpoint Discovery Registry
 *
 * Complete metadata catalog for all 26 paid API endpoints.
 * Provides input/output examples and JSON schemas for the Bazaar discovery layer.
 */

import type { EndpointMetadata } from "./types";
import { TOKEN_TYPE_SCHEMA } from "../utils/schema-helpers";

// =============================================================================
// Shared Constants
// =============================================================================

/** Token type query parameter, repeated across most paid endpoints */
const TOKEN_TYPE_PARAM = TOKEN_TYPE_SCHEMA;

/** Standard queryParams containing only the tokenType selector */
const TOKEN_TYPE_QUERY: Record<string, unknown> = {
  tokenType: TOKEN_TYPE_PARAM,
};

// =============================================================================
// REGISTRY ENDPOINTS (7 paid)
// =============================================================================

const registryEndpoints: EndpointMetadata[] = [
  {
    path: "/registry/probe",
    method: "POST",
    category: "registry",
    description: "Probe an x402 endpoint to discover payment requirements and metadata",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "The x402 endpoint URL to probe" },
        timeout: { type: "number", description: "Timeout in milliseconds", default: 10000 },
      },
    },
    outputExample: {
      success: true,
      isX402Endpoint: true,
      data: {
        paymentAddress: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        acceptedTokens: ["STX", "sBTC", "USDCx"],
        prices: { STX: "1000", sBTC: "1000", USDCx: "1000" },
        responseTimeMs: 120,
        supportedMethods: ["GET", "POST"],
        openApiSchema: {},
        probeTimestamp: "2024-01-01T00:00:00.000Z",
      },
      tokenType: "STX",
    },
  },
  {
    path: "/registry/register",
    method: "POST",
    category: "registry",
    description: "Register an x402 endpoint in the directory",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["url", "name", "description"],
      properties: {
        url: { type: "string", description: "The x402 endpoint URL to register" },
        name: { type: "string", description: "Display name for the endpoint" },
        description: { type: "string", description: "Description of what the endpoint does" },
        owner: { type: "string", description: "Owner STX address (defaults to payer address if not specified)" },
        category: { type: "string", description: "Category for filtering (e.g., 'ai', 'data', 'utility')" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for discovery" },
      },
    },
    outputExample: {
      success: true,
      entry: {
        id: "d4e5f6a7b8c9",
        url: "https://api.example.com/endpoint",
        name: "Example Endpoint",
        description: "An example x402 endpoint",
        owner: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        status: "unverified",
        category: "ai",
        registeredAt: "2024-01-01T00:00:00.000Z",
      },
      probeResult: {
        isX402Endpoint: true,
        paymentAddress: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        acceptedTokens: ["STX"],
        responseTimeMs: 150,
      },
      tokenType: "STX",
    },
  },
  {
    path: "/registry/details",
    method: "POST",
    category: "registry",
    description: "Get full details of a registered x402 endpoint with optional live health check",
    bodyType: "json",
    bodySchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The endpoint URL to look up" },
        id: { type: "string", description: "The endpoint ID (alternative to URL)" },
        owner: { type: "string", description: "Owner address (required if using id)" },
        liveProbe: { type: "boolean", description: "Perform a live health check", default: true },
      },
    },
    outputExample: {
      entry: {
        id: "d4e5f6a7b8c9",
        url: "https://api.example.com/endpoint",
        name: "Example Endpoint",
        description: "An example x402 endpoint",
        owner: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        status: "verified",
        category: "ai",
        tags: ["inference", "llm"],
        registeredAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        registeredBy: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        probeData: {
          paymentAddress: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
          acceptedTokens: ["STX"],
        },
      },
      liveStatus: {
        isOnline: true,
        responseTimeMs: 120,
        checkedAt: "2024-01-03T00:00:00.000Z",
      },
      tokenType: "STX",
    },
  },
  {
    path: "/registry/update",
    method: "POST",
    category: "registry",
    description: "Update a registered x402 endpoint (owner only, requires signature or payment auth)",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "The endpoint URL to update" },
        owner: { type: "string", description: "Owner STX address (defaults to payer address, must match registered owner)" },
        name: { type: "string", description: "New display name" },
        description: { type: "string", description: "New description" },
        category: { type: "string", description: "New category" },
        tags: { type: "array", items: { type: "string" }, description: "New tags" },
        reprobeEndpoint: { type: "boolean", description: "Re-probe the endpoint to update probe data", default: false },
        signature: { type: "string", description: "SIP-018 signature proving ownership (optional if payment is from owner)" },
        timestamp: { type: "number", description: "Unix timestamp (ms) for signature (required with signature)" },
      },
    },
    outputExample: {
      success: true,
      entry: {
        id: "d4e5f6a7b8c9",
        url: "https://api.example.com/endpoint",
        name: "Updated Name",
        description: "Updated description",
        owner: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        status: "verified",
        category: "data",
        tags: ["updated"],
        updatedAt: "2024-01-03T00:00:00.000Z",
      },
      verifiedBy: "payment",
      tokenType: "STX",
    },
  },
  {
    path: "/registry/delete",
    method: "POST",
    category: "registry",
    description: "Delete a registered x402 endpoint (owner only, requires SIP-018 signature)",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "The endpoint URL to delete" },
        owner: { type: "string", description: "Owner STX address (defaults to payer address, must match registered owner)" },
        signature: { type: "string", description: "SIP-018 signature of the delete challenge (required for deletion)" },
        challengeId: { type: "string", description: "Challenge ID from initial request (required with signature)" },
      },
    },
    outputExample: {
      success: true,
      deleted: {
        id: "d4e5f6a7b8c9",
        url: "https://api.example.com/endpoint",
        name: "Example Endpoint",
      },
      verifiedBy: "signature",
      tokenType: "STX",
    },
  },
  {
    path: "/registry/my-endpoints",
    method: "POST",
    category: "registry",
    description: "List all endpoints owned by an address (auth via signature or payment)",
    bodyType: "json",
    bodySchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Owner STX address to list endpoints for (defaults to payer address)" },
        signature: { type: "string", description: "SIP-018 signature proving ownership (optional if paying from same address)" },
        timestamp: { type: "number", description: "Timestamp when signature was created (required with signature)" },
      },
    },
    outputExample: {
      entries: [
        {
          id: "d4e5f6a7b8c9",
          url: "https://api.example.com/endpoint",
          name: "Example Endpoint",
          description: "An example x402 endpoint",
          category: "ai",
          status: "verified",
          tags: ["inference"],
          registeredAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
          probeData: {
            paymentAddress: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
            acceptedTokens: ["STX"],
            responseTimeMs: 120,
          },
        },
      ],
      count: 1,
      authenticatedBy: "payment",
      tokenType: "STX",
    },
  },
  {
    path: "/registry/transfer",
    method: "POST",
    category: "registry",
    description: "Transfer ownership of a registered endpoint (requires SIP-018 signature)",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["url", "newOwner"],
      properties: {
        url: { type: "string", description: "The endpoint URL to transfer" },
        owner: { type: "string", description: "Current owner STX address (defaults to payer address)" },
        newOwner: { type: "string", description: "New owner STX address to transfer to" },
        signature: { type: "string", description: "SIP-018 signature of the transfer challenge" },
        challengeId: { type: "string", description: "Challenge ID from initial request" },
      },
    },
    outputExample: {
      success: true,
      transferred: {
        url: "https://api.example.com/endpoint",
        name: "Example Endpoint",
        from: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        to: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
      },
      entry: {
        id: "d4e5f6a7b8c9",
        url: "https://api.example.com/endpoint",
        name: "Example Endpoint",
        owner: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
        status: "verified",
      },
      verifiedBy: "signature",
      tokenType: "STX",
    },
  },
];

// =============================================================================
// LINKS ENDPOINTS (4 paid)
// =============================================================================

const linksEndpoints: EndpointMetadata[] = [
  {
    path: "/links/create",
    method: "POST",
    category: "links",
    description: "Create a short URL with optional custom slug and expiration",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri", description: "Target URL to shorten" },
        slug: { type: "string", minLength: 3, maxLength: 32, description: "Custom slug (3-32 chars, optional)" },
        title: { type: "string", maxLength: 256, description: "Optional title/description for the link" },
        ttl: { type: "number", minimum: 60, description: "Time to live in seconds (optional, no expiration if omitted)" },
      },
    },
    outputExample: {
      slug: "my-link",
      shortUrl: "https://stx402.com/links/expand/my-link",
      url: "https://example.com/very/long/url",
      title: "Example Link",
      expiresAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      tokenType: "STX",
    },
  },
  {
    path: "/links/stats",
    method: "POST",
    category: "links",
    description: "Get click statistics and analytics for a short link",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: "The short link slug" },
      },
    },
    outputExample: {
      slug: "my-link",
      url: "https://example.com/very/long/url",
      title: "Example Link",
      clicks: 42,
      createdAt: "2024-01-01T00:00:00.000Z",
      lastClickAt: "2024-01-03T12:30:00.000Z",
      referrers: {
        "twitter.com": 20,
        "reddit.com": 15,
        direct: 7,
      },
      recentClicks: [
        {
          clickedAt: "2024-01-03T12:30:00.000Z",
          referrer: "twitter.com",
          country: "US",
        },
      ],
      tokenType: "STX",
    },
  },
  {
    path: "/links/delete",
    method: "POST",
    category: "links",
    description: "Delete a short link you own",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: "The short link slug to delete" },
      },
    },
    outputExample: {
      deleted: true,
      slug: "my-link",
      tokenType: "STX",
    },
  },
  {
    path: "/links/list",
    method: "GET",
    category: "links",
    description: "List all short links you own",
    queryParams: TOKEN_TYPE_QUERY,
    outputExample: {
      links: [
        {
          slug: "my-link",
          url: "https://example.com/very/long/url",
          shortUrl: "https://stx402.com/links/expand/my-link",
          title: "Example Link",
          clicks: 42,
          expiresAt: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      count: 1,
      tokenType: "STX",
    },
  },
];

// =============================================================================
// AGENT IDENTITY ENDPOINTS (6 paid)
// =============================================================================

const agentIdentityEndpoints: EndpointMetadata[] = [
  {
    path: "/agent/info",
    method: "POST",
    category: "agent",
    description: "Get full agent info (owner and metadata URI) from ERC-8004 identity registry",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId"],
      properties: {
        agentId: { type: "number", description: "Agent ID from the identity registry" },
        network: { type: "string", enum: ["mainnet", "testnet"], description: "Network to query", default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      owner: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
      uri: "https://agent-metadata.example.com/1.json",
      network: "testnet",
      contractId: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.erc8004-identity-registry-v1",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/owner",
    method: "GET",
    category: "agent",
    description: "Get agent owner address from ERC-8004 identity registry",
    queryParams: {
      agentId: { type: "number", description: "Agent ID" },
      network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      tokenType: TOKEN_TYPE_PARAM,
    },
    outputExample: {
      agentId: 1,
      owner: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/uri",
    method: "GET",
    category: "agent",
    description: "Get agent metadata URI from ERC-8004 identity registry",
    queryParams: {
      agentId: { type: "number", description: "Agent ID" },
      network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      tokenType: TOKEN_TYPE_PARAM,
    },
    outputExample: {
      agentId: 1,
      uri: "https://agent-metadata.example.com/1.json",
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/metadata",
    method: "POST",
    category: "agent",
    description: "Get agent metadata value by key from ERC-8004 identity registry",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId", "key"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        key: { type: "string", description: "Metadata key to retrieve" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      key: "name",
      value: "Example Agent",
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/version",
    method: "GET",
    category: "agent",
    description: "Get ERC-8004 identity registry contract version",
    queryParams: {
      network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      tokenType: TOKEN_TYPE_PARAM,
    },
    outputExample: {
      version: "1.0.0",
      registry: "identity",
      contractId: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.erc8004-identity-registry-v1",
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/lookup",
    method: "POST",
    category: "agent",
    description: "Find all agent IDs owned by an address (scans ERC-8004 identity registry)",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["owner"],
      properties: {
        owner: { type: "string", description: "Owner address to search for" },
        maxScan: { type: "number", description: "Maximum number of agent IDs to scan", default: 100 },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      owner: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
      agents: [1, 5, 12],
      count: 3,
      scanned: 100,
      network: "testnet",
      tokenType: "STX",
    },
  },
];

// =============================================================================
// AGENT REPUTATION ENDPOINTS (5 paid)
// =============================================================================

const agentReputationEndpoints: EndpointMetadata[] = [
  {
    path: "/agent/reputation/summary",
    method: "POST",
    category: "agent",
    description: "Get reputation summary for an agent (feedback count and average score)",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      feedbackCount: 25,
      averageScore: 8,
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/reputation/feedback",
    method: "POST",
    category: "agent",
    description: "Get specific feedback entry for an agent",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId", "client", "index"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        client: { type: "string", description: "Client address that gave feedback" },
        index: { type: "number", description: "Feedback entry index" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      client: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
      index: 0,
      feedback: {
        score: 9,
        comment: "Excellent service",
        timestamp: 1704067200,
      },
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/reputation/list",
    method: "POST",
    category: "agent",
    description: "List all feedback for an agent",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      feedback: [
        {
          client: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
          index: 0,
          score: 9,
          comment: "Excellent service",
          timestamp: 1704067200,
        },
      ],
      count: 1,
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/reputation/clients",
    method: "POST",
    category: "agent",
    description: "List all clients who have given feedback to an agent",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      clients: ["SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE"],
      count: 1,
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/reputation/auth-hash",
    method: "POST",
    category: "agent",
    description: "Generate SIP-018 auth hash for submitting feedback",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId", "signer", "indexLimit", "expiryBlockHeight"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        signer: { type: "string", description: "Client address that will sign" },
        indexLimit: { type: "number", description: "Maximum feedback entries allowed" },
        expiryBlockHeight: { type: "number", description: "Block height when auth expires" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      messageHash: "0x1234567890abcdef",
      domain: {
        name: "ERC8004 Reputation Registry",
        version: "1.0.0",
        chainId: 2147483648,
      },
      structuredData: {
        agentId: 1,
        signer: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
        indexLimit: 10,
        expiryBlockHeight: 200000,
      },
      network: "testnet",
      tokenType: "STX",
    },
  },
];

// =============================================================================
// AGENT VALIDATION ENDPOINTS (4 paid)
// =============================================================================

const agentValidationEndpoints: EndpointMetadata[] = [
  {
    path: "/agent/validation/status",
    method: "POST",
    category: "agent",
    description: "Get validation request status",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["requestHash"],
      properties: {
        requestHash: { type: "string", description: "Validation request hash" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      requestHash: "0xabcdef1234567890",
      status: "pending",
      agentId: 1,
      validator: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/validation/summary",
    method: "POST",
    category: "agent",
    description: "Get validation summary for an agent",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      validationCount: 10,
      averageResponse: 85,
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/validation/list",
    method: "POST",
    category: "agent",
    description: "List all validations for an agent",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["agentId"],
      properties: {
        agentId: { type: "number", description: "Agent ID" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      agentId: 1,
      validations: [
        {
          requestHash: "0xabcdef1234567890",
          validator: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
          response: 90,
          timestamp: 1704067200,
        },
      ],
      count: 1,
      network: "testnet",
      tokenType: "STX",
    },
  },
  {
    path: "/agent/validation/requests",
    method: "POST",
    category: "agent",
    description: "List pending validation requests for a validator",
    bodyType: "json",
    bodySchema: {
      type: "object",
      required: ["validator"],
      properties: {
        validator: { type: "string", description: "Validator address" },
        network: { type: "string", enum: ["mainnet", "testnet"], default: "testnet" },
      },
    },
    outputExample: {
      validator: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
      requests: [
        {
          requestHash: "0xabcdef1234567890",
          agentId: 1,
          status: "pending",
          timestamp: 1704067200,
        },
      ],
      count: 1,
      network: "testnet",
      tokenType: "STX",
    },
  },
];

// =============================================================================
// REGISTRY EXPORT
// =============================================================================

/** All endpoint metadata arrays combined */
const ALL_ENDPOINTS: EndpointMetadata[] = [
  ...registryEndpoints,
  ...linksEndpoints,
  ...agentIdentityEndpoints,
  ...agentReputationEndpoints,
  ...agentValidationEndpoints,
];

/**
 * Build a registry key from method and path.
 * Uses "METHOD /path" format to avoid collisions when multiple
 * HTTP methods share the same path (e.g., GET and POST on /storage/kv).
 */
function registryKey(method: string, path: string): string {
  return `${method} ${path}`;
}

/**
 * Complete endpoint metadata registry.
 * Keyed by "METHOD /path" to disambiguate endpoints that share a path.
 */
export const ENDPOINT_METADATA_REGISTRY = new Map<string, EndpointMetadata>(
  ALL_ENDPOINTS.map((e) => [registryKey(e.method, e.path), e])
);

/**
 * Get metadata for an endpoint by path and optional method.
 *
 * When method is provided, performs an exact lookup.
 * When method is omitted, falls back to scanning for any matching path
 * (for backward compatibility).
 *
 * Supports query strings and trailing slashes: /agent/owner?agentId=1 matches /agent/owner
 */
export function getEndpointMetadata(
  path: string,
  method?: string
): EndpointMetadata | undefined {
  // Normalize: strip query string and trailing slash
  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/";

  // Exact lookup when method is provided
  if (method) {
    const exact = ENDPOINT_METADATA_REGISTRY.get(
      registryKey(method, normalized)
    );
    if (exact) return exact;
  }

  // Scan for matching path
  for (const metadata of ENDPOINT_METADATA_REGISTRY.values()) {
    if (method && metadata.method !== method) continue;

    if (metadata.path === normalized) return metadata;
  }

  return undefined;
}
