/**
 * Endpoint Registry for STX402 Directory Tests
 *
 * Central configuration for all paid endpoints with test data and validation.
 * Used by _run_all_tests.ts for comprehensive E2E payment testing.
 *
 * STX402 Directory focuses on:
 * - Registry: X402 endpoint discovery
 * - Agent: ERC-8004 agent identity on Stacks
 * - Links: URL shortener with analytics
 */

import type { TestConfig } from "./_test_generator";
import type { TokenType } from "x402-stacks";

// =============================================================================
// Test Fixtures - Reusable test data
// =============================================================================

const FIXTURES = {
  // Stacks addresses
  mainnetAddress: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
  testnetAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
};

// =============================================================================
// Validation Helpers
// =============================================================================

type DataWithToken = { tokenType: TokenType };

const hasTokenType = (data: unknown, tokenType: TokenType): boolean => {
  const d = data as DataWithToken;
  return d.tokenType === tokenType;
};

const hasField = (data: unknown, field: string): boolean => {
  return typeof data === "object" && data !== null && field in data;
};

const hasFields = (data: unknown, fields: string[]): boolean => {
  return fields.every((f) => hasField(data, f));
};

// =============================================================================
// REGISTRY ENDPOINTS (10) - X402 Directory
// =============================================================================

const registryEndpoints: TestConfig[] = [
  {
    name: "registry-probe",
    endpoint: "/registry/probe",
    method: "POST",
    body: { url: "https://example.com/api/test" },
    validateResponse: (data, tokenType) =>
      hasField(data, "success") && hasTokenType(data, tokenType),
  },
  {
    name: "registry-register",
    endpoint: "/registry/register",
    method: "POST",
    body: {
      url: `https://example.com/api/test-${Date.now()}`,
      name: "Test Endpoint",
      description: "A test endpoint for registration",
      category: "utility",
    },
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-list",
    endpoint: "/registry/list",
    method: "GET",
    skipPayment: true,
    validateResponse: (data) => hasField(data, "entries"),
  },
  {
    name: "registry-details",
    endpoint: "/registry/details",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-update",
    endpoint: "/registry/update",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent", description: "Updated" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-delete",
    endpoint: "/registry/delete",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-my-endpoints",
    endpoint: "/registry/my-endpoints",
    method: "POST",
    body: {},
    validateResponse: (data, tokenType) =>
      hasField(data, "entries") && hasTokenType(data, tokenType),
  },
  {
    name: "registry-transfer",
    endpoint: "/registry/transfer",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent", newOwner: FIXTURES.mainnetAddress },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "admin-registry-verify",
    endpoint: "/admin/registry/verify",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent", action: "verify", adminAddress: FIXTURES.mainnetAddress },
    skipPayment: true,
    allowedStatuses: [403],
    validateResponse: (data) => {
      return hasField(data, "error") || hasField(data, "success");
    },
  },
  {
    name: "admin-registry-pending",
    endpoint: "/admin/registry/pending",
    method: "POST",
    body: { adminAddress: FIXTURES.mainnetAddress },
    skipPayment: true,
    allowedStatuses: [403],
    validateResponse: (data) => {
      return hasField(data, "error") || hasField(data, "entries");
    },
  },
];

// =============================================================================
// LINKS ENDPOINTS (5) - URL Shortener
// =============================================================================

const linksEndpoints: TestConfig[] = [
  {
    name: "links-create",
    endpoint: "/links/create",
    method: "POST",
    body: { url: "https://example.com", title: "Example Site" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["slug", "shortUrl", "url"]) && hasTokenType(data, tokenType),
  },
  {
    name: "links-expand",
    endpoint: "/links/expand/nonexistent",
    method: "GET",
    skipPayment: true,
    allowedStatuses: [404],
    validateResponse: (data) => {
      return hasField(data, "url") || hasField(data, "error");
    },
  },
  {
    name: "links-stats",
    endpoint: "/links/stats",
    method: "POST",
    body: { slug: "nonexistent" },
    allowedStatuses: [404],
    validateResponse: (data) => {
      return hasField(data, "error");
    },
  },
  {
    name: "links-delete",
    endpoint: "/links/delete",
    method: "POST",
    body: { slug: "nonexistent" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["deleted", "slug"]) && hasTokenType(data, tokenType),
  },
  {
    name: "links-list",
    endpoint: "/links/list",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["links", "count"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// AGENT REGISTRY ENDPOINTS (16) - ERC-8004
// =============================================================================

const agentEndpoints: TestConfig[] = [
  {
    name: "agent-registry",
    endpoint: "/agent/registry",
    method: "GET",
    skipPayment: true,
    validateResponse: (data) =>
      hasFields(data, ["networks", "specification", "registries"]),
  },
  {
    name: "agent-info",
    endpoint: "/agent/info?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-owner",
    endpoint: "/agent/owner?agentId=0&network=testnet",
    method: "GET",
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-uri",
    endpoint: "/agent/uri?agentId=0&network=testnet",
    method: "GET",
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-metadata",
    endpoint: "/agent/metadata?network=testnet",
    method: "POST",
    body: { agentId: 0, key: "name" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-version",
    endpoint: "/agent/version?network=testnet",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["version", "registry"]) && hasTokenType(data, tokenType),
  },
  {
    name: "agent-lookup",
    endpoint: "/agent/lookup?network=testnet",
    method: "POST",
    body: { owner: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18", maxScan: 5 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["owner", "agents", "count"]) && hasTokenType(data, tokenType),
  },
  {
    name: "reputation-summary",
    endpoint: "/agent/reputation/summary?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["count", "averageScore"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "reputation-feedback",
    endpoint: "/agent/reputation/feedback?network=testnet",
    method: "POST",
    body: { agentId: 0, client: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18", index: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "reputation-list",
    endpoint: "/agent/reputation/list?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["feedback", "count"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "reputation-clients",
    endpoint: "/agent/reputation/clients?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["clients", "count"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "reputation-auth-hash",
    endpoint: "/agent/reputation/auth-hash?network=testnet",
    method: "POST",
    body: {
      agentId: 0,
      signer: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18",
      indexLimit: 10,
      expiryBlockHeight: 999999,
    },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["messageHash", "domain", "structuredData"]) && hasTokenType(data, tokenType),
  },
  {
    name: "validation-status",
    endpoint: "/agent/validation/status?network=testnet",
    method: "POST",
    body: { requestHash: "0x" + "0".repeat(64) },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "validation-summary",
    endpoint: "/agent/validation/summary?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["count", "averageResponse"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "validation-list",
    endpoint: "/agent/validation/list?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["validations", "count"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "validation-requests",
    endpoint: "/agent/validation/requests?network=testnet",
    method: "POST",
    body: { validator: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["requests", "count"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// EXPORT COMBINED REGISTRY
// =============================================================================

// All endpoints are stateless or have lifecycle tests
export const STATELESS_ENDPOINTS: TestConfig[] = [
  ...agentEndpoints,
];

// Stateful categories - should use lifecycle tests for full CRUD
export const STATEFUL_CATEGORIES = ["registry", "links"] as const;

export type StatefulCategory = (typeof STATEFUL_CATEGORIES)[number];

// Full registry for reference (includes all endpoints)
export const ENDPOINT_REGISTRY: TestConfig[] = [
  ...registryEndpoints,
  ...linksEndpoints,
  ...agentEndpoints,
];

// Category mapping for filtered runs
export const ENDPOINT_CATEGORIES: Record<string, TestConfig[]> = {
  registry: registryEndpoints,
  links: linksEndpoints,
  agent: agentEndpoints,
};

// Check if a category is stateful
export function isStatefulCategory(category: string): category is StatefulCategory {
  return STATEFUL_CATEGORIES.includes(category as StatefulCategory);
}

// Export counts for verification
export const ENDPOINT_COUNTS = {
  total: ENDPOINT_REGISTRY.length, // 31 tests
  stateless: STATELESS_ENDPOINTS.length, // 16 (agent only)
  registry: registryEndpoints.length, // 10
  links: linksEndpoints.length, // 5
  agent: agentEndpoints.length, // 16
};
