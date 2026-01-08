/**
 * Endpoint Registry for X402 Tests
 *
 * Central configuration for all paid endpoints with test data and validation.
 * Used by _run_all_tests.ts for comprehensive E2E payment testing.
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
  bnsAddress: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9", // Has BNS name: friedgerpool.id

  // Contracts
  mainnetContract: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait",
  testnetContract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait",

  // Sample text
  shortText: "Hello, World!",
  longText: "The quick brown fox jumps over the lazy dog.",
  utf8Text: "Hello 世界 🌍",

  // Sample data
  simpleJson: { name: "test", value: 42 },
  simpleCsv: "name,age\nAlice,30\nBob,25",

  // Hashes (precomputed for "test")
  sha256OfTest: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  base64OfTest: "dGVzdA==",
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
// STACKS ENDPOINTS (7) - Clarity utilities + aggregated endpoints
// =============================================================================

const stacksEndpoints: TestConfig[] = [
  {
    name: "convert-address",
    endpoint: `/api/stacks/convert-address/${FIXTURES.mainnetAddress}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["address", "convertedAddress", "network"]) && hasTokenType(data, tokenType),
  },
  {
    name: "decode-clarity-hex",
    endpoint: "/api/stacks/decode-clarity-hex",
    method: "POST",
    body: { hex: "0x0100000000000000000000000000000001" },
    validateResponse: (data, tokenType) =>
      hasField(data, "decoded") && hasTokenType(data, tokenType),
  },
  {
    name: "to-consensus-buff",
    endpoint: "/api/stacks/to-consensus-buff",
    method: "POST",
    body: { value: { type: "uint", value: "1" } },
    validateResponse: (data, tokenType) =>
      hasField(data, "hex") && hasTokenType(data, tokenType),
  },
  {
    name: "from-consensus-buff",
    endpoint: "/api/stacks/from-consensus-buff",
    method: "POST",
    body: { hex: "0x0100000000000000000000000000000001" },
    validateResponse: (data, tokenType) =>
      hasField(data, "value") && hasTokenType(data, tokenType),
  },
  {
    name: "decode-tx",
    endpoint: "/api/stacks/decode-tx",
    method: "POST",
    body: {
      hex: "0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000003200000000000000b400008537046ff1008368baaa3ff2235122c556b89dad4f9df0639b924cf32a44b866497e49846b24191e711b21faaae96ca0542e4a140168484740b94211cececb3303020000000000051ab52c45b1a7977204f17ac0b6f48306aea2dbb8e9000000000007a12046617563657400000000000000000000000000000000000000000000000000000000",
    },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["version", "payloadType", "payload"]) && hasTokenType(data, tokenType),
  },
  {
    name: "profile",
    endpoint: `/api/stacks/profile/${FIXTURES.mainnetAddress}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["address", "network", "stxBalance", "ftBalances", "nftCount", "blockHeight"]) && hasTokenType(data, tokenType),
  },
  {
    name: "contract-info",
    endpoint: `/api/stacks/contract-info/${FIXTURES.mainnetContract}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["contractId", "source", "sourceHash", "abi", "summary"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// AI ENDPOINTS (13)
// =============================================================================

const aiEndpoints: TestConfig[] = [
  {
    name: "dad-joke",
    endpoint: "/api/ai/dad-joke",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "joke") && hasTokenType(data, tokenType),
  },
  {
    name: "summarize",
    endpoint: "/api/ai/summarize",
    method: "POST",
    body: { text: FIXTURES.longText, maxLength: 50 },
    validateResponse: (data, tokenType) =>
      hasField(data, "summary") && hasTokenType(data, tokenType),
  },
  {
    name: "image-describe",
    endpoint: "/api/ai/image-describe",
    method: "POST",
    body: { image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==" },
    validateResponse: (data, tokenType) =>
      hasField(data, "description") && hasTokenType(data, tokenType),
  },
  {
    name: "tts",
    endpoint: "/api/ai/tts",
    method: "POST",
    body: { text: "Hello world" },
    expectedContentType: "audio",
    validateResponse: () => true,
  },
  {
    name: "generate-image",
    endpoint: "/api/ai/generate-image",
    method: "POST",
    body: { prompt: "a peaceful mountain landscape with blue sky and green trees" },
    expectedContentType: "image",
    validateResponse: () => true,
  },
  {
    name: "explain-contract",
    endpoint: `/api/ai/explain-contract/${FIXTURES.mainnetContract}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "explanation") && hasTokenType(data, tokenType),
  },
  {
    name: "translate",
    endpoint: "/api/ai/translate",
    method: "POST",
    body: { text: "Hello world", target: "es" },
    validateResponse: (data, tokenType) =>
      hasField(data, "translated") && hasTokenType(data, tokenType),
  },
  {
    name: "sentiment",
    endpoint: "/api/ai/sentiment",
    method: "POST",
    body: { text: "I love this product! It's amazing!" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["sentiment", "score"]) && hasTokenType(data, tokenType),
  },
  {
    name: "keywords",
    endpoint: "/api/ai/keywords",
    method: "POST",
    body: { text: FIXTURES.longText },
    validateResponse: (data, tokenType) =>
      hasField(data, "keywords") && hasTokenType(data, tokenType),
  },
  {
    name: "language-detect",
    endpoint: "/api/ai/language-detect",
    method: "POST",
    body: { text: "Bonjour le monde" },
    validateResponse: (data, tokenType) =>
      hasField(data, "language") && hasTokenType(data, tokenType),
  },
  {
    name: "paraphrase",
    endpoint: "/api/ai/paraphrase",
    method: "POST",
    body: { text: FIXTURES.longText },
    validateResponse: (data, tokenType) =>
      hasField(data, "paraphrased") && hasTokenType(data, tokenType),
  },
  {
    name: "grammar-check",
    endpoint: "/api/ai/grammar-check",
    method: "POST",
    body: { text: "He go to the store yesterday." },
    validateResponse: (data, tokenType) =>
      hasField(data, "corrected") && hasTokenType(data, tokenType),
  },
  {
    name: "question-answer",
    endpoint: "/api/ai/question-answer",
    method: "POST",
    body: { context: "The sky is blue.", question: "What color is the sky?" },
    validateResponse: (data, tokenType) =>
      hasField(data, "answer") && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// HASH ENDPOINTS (6)
// =============================================================================

const hashEndpoints: TestConfig[] = [
  {
    name: "sha256",
    endpoint: "/api/hash/sha256",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) => {
      const d = data as { hash: string; tokenType: TokenType };
      return d.hash === FIXTURES.sha256OfTest && d.tokenType === tokenType;
    },
  },
  {
    name: "sha512",
    endpoint: "/api/hash/sha512",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "keccak256",
    endpoint: "/api/hash/keccak256",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "hash160",
    endpoint: "/api/hash/hash160",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "ripemd160",
    endpoint: "/api/hash/ripemd160",
    method: "POST",
    body: { data: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "hmac",
    endpoint: "/api/hash/hmac",
    method: "POST",
    body: { message: "message", key: "secret" },
    validateResponse: (data, tokenType) =>
      hasField(data, "hmac") && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// DATA ENDPOINTS (2) - FREE
// =============================================================================

const dataEndpoints: TestConfig[] = [
  {
    name: "json-minify",
    endpoint: "/api/data/json-minify",
    method: "POST",
    body: { json: '{\n  "a": 1\n}' },
    skipPayment: true,
    validateResponse: (data) => {
      const d = data as { minified: string };
      return d.minified === '{"a":1}';
    },
  },
  {
    name: "json-validate",
    endpoint: "/api/data/json-validate",
    method: "POST",
    body: { json: '{"valid": true}' },
    skipPayment: true,
    validateResponse: (data) => {
      const d = data as { valid: boolean };
      return d.valid === true;
    },
  },
];

// =============================================================================
// UTILITY ENDPOINTS (2)
// =============================================================================

const utilEndpoints: TestConfig[] = [
  {
    name: "qr-generate",
    endpoint: "/api/util/qr-generate",
    method: "POST",
    body: { data: "https://example.com", format: "base64" },
    validateResponse: (data, tokenType) =>
      hasField(data, "base64") && hasTokenType(data, tokenType),
  },
  {
    name: "verify-signature",
    endpoint: "/api/util/verify-signature",
    method: "POST",
    body: {
      signature: "0".repeat(130),
      address: FIXTURES.mainnetAddress,
      mode: "simple",
      message: "test message",
    },
    validateResponse: (data, tokenType) => {
      const d = data as { valid: boolean; mode: string; tokenType: TokenType };
      return d.mode === "simple" && d.tokenType === tokenType && "valid" in d;
    },
  },
];

// =============================================================================
// KV STORAGE ENDPOINTS (4)
// =============================================================================

const kvEndpoints: TestConfig[] = [
  {
    name: "kv-set",
    endpoint: "/api/kv/set",
    method: "POST",
    body: { key: `test-${Date.now()}`, value: { test: true }, ttl: 60, visibility: "private" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["success", "key", "bytes"]) && hasTokenType(data, tokenType),
  },
  {
    name: "kv-get",
    endpoint: "/api/kv/get",
    method: "POST",
    body: { key: "nonexistent-key-for-404-test" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "kv-list",
    endpoint: "/api/kv/list",
    method: "POST",
    body: { prefix: "test-", limit: 10 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["keys", "complete"]) && hasTokenType(data, tokenType),
  },
  {
    name: "kv-delete",
    endpoint: "/api/kv/delete",
    method: "POST",
    body: { key: "nonexistent-key-for-404-test" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
];

// =============================================================================
// PASTE ENDPOINTS (3)
// =============================================================================

const pasteEndpoints: TestConfig[] = [
  {
    name: "paste-create",
    endpoint: "/api/paste/create",
    method: "POST",
    body: { content: "Hello, World! This is a test paste.", language: "text", ttl: 60 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["code", "url", "expiresAt", "bytes"]) && hasTokenType(data, tokenType),
  },
  {
    name: "paste-get",
    endpoint: "/api/paste/abc123",
    method: "GET",
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "paste-delete",
    endpoint: "/api/paste/delete",
    method: "POST",
    body: { code: "abc123" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
];

// =============================================================================
// COUNTER ENDPOINTS (6) - Durable Objects
// =============================================================================

const counterEndpoints: TestConfig[] = [
  {
    name: "counter-increment",
    endpoint: "/api/counter/increment",
    method: "POST",
    body: { name: `test-counter-${Date.now()}`, step: 1 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["name", "value", "previousValue"]) && hasTokenType(data, tokenType),
  },
  {
    name: "counter-decrement",
    endpoint: "/api/counter/decrement",
    method: "POST",
    body: { name: `test-counter-${Date.now()}`, step: 1 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["name", "value", "previousValue"]) && hasTokenType(data, tokenType),
  },
  {
    name: "counter-get",
    endpoint: "/api/counter/get?name=nonexistent-counter",
    method: "GET",
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "counter-reset",
    endpoint: "/api/counter/reset",
    method: "POST",
    body: { name: `test-counter-${Date.now()}`, resetTo: 0 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["name", "value", "previousValue"]) && hasTokenType(data, tokenType),
  },
  {
    name: "counter-list",
    endpoint: "/api/counter/list",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["counters", "count"]) && hasTokenType(data, tokenType),
  },
  {
    name: "counter-delete",
    endpoint: "/api/counter/delete",
    method: "POST",
    body: { name: "nonexistent-counter" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["deleted", "name"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// REGISTRY ENDPOINTS (10)
// =============================================================================

const registryEndpoints: TestConfig[] = [
  {
    name: "registry-probe",
    endpoint: "/api/registry/probe",
    method: "POST",
    body: { url: "https://example.com/api/test" },
    validateResponse: (data, tokenType) =>
      hasField(data, "success") && hasTokenType(data, tokenType),
  },
  {
    name: "registry-register",
    endpoint: "/api/registry/register",
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
    endpoint: "/api/registry/list",
    method: "GET",
    skipPayment: true,
    validateResponse: (data) => hasField(data, "entries"),
  },
  {
    name: "registry-details",
    endpoint: "/api/registry/details",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-update",
    endpoint: "/api/registry/update",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent", description: "Updated" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-delete",
    endpoint: "/api/registry/delete",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-my-endpoints",
    endpoint: "/api/registry/my-endpoints",
    method: "POST",
    body: {},
    validateResponse: (data, tokenType) =>
      hasField(data, "entries") && hasTokenType(data, tokenType),
  },
  {
    name: "registry-transfer",
    endpoint: "/api/registry/transfer",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent", newOwner: FIXTURES.mainnetAddress },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "admin-registry-verify",
    endpoint: "/api/admin/registry/verify",
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
    endpoint: "/api/admin/registry/pending",
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
// SQL ENDPOINTS (3) - Durable Objects
// =============================================================================

const sqlEndpoints: TestConfig[] = [
  {
    name: "sql-query",
    endpoint: "/api/sql/query",
    method: "POST",
    body: { query: "SELECT 1 as test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["rows", "rowCount", "columns"]) && hasTokenType(data, tokenType),
  },
  {
    name: "sql-execute",
    endpoint: "/api/sql/execute",
    method: "POST",
    body: { query: "CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["success", "rowsAffected"]) && hasTokenType(data, tokenType),
  },
  {
    name: "sql-schema",
    endpoint: "/api/sql/schema",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "tables") && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// LINKS ENDPOINTS (5) - Durable Objects URL Shortener
// =============================================================================

const linksEndpoints: TestConfig[] = [
  {
    name: "links-create",
    endpoint: "/api/links/create",
    method: "POST",
    body: { url: "https://example.com", title: "Example Site" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["slug", "shortUrl", "url"]) && hasTokenType(data, tokenType),
  },
  {
    name: "links-expand",
    endpoint: "/api/links/expand/nonexistent",
    method: "GET",
    skipPayment: true,
    allowedStatuses: [404],
    validateResponse: (data) => {
      return hasField(data, "url") || hasField(data, "error");
    },
  },
  {
    name: "links-stats",
    endpoint: "/api/links/stats",
    method: "POST",
    body: { slug: "nonexistent" },
    allowedStatuses: [404],
    validateResponse: (data) => {
      return hasField(data, "error");
    },
  },
  {
    name: "links-delete",
    endpoint: "/api/links/delete",
    method: "POST",
    body: { slug: "nonexistent" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["deleted", "slug"]) && hasTokenType(data, tokenType),
  },
  {
    name: "links-list",
    endpoint: "/api/links/list",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["links", "count"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// SYNC ENDPOINTS (5) - Durable Objects Distributed Locks
// =============================================================================

const syncEndpoints: TestConfig[] = [
  {
    name: "sync-lock",
    endpoint: "/api/sync/lock",
    method: "POST",
    body: { name: "test-lock", ttl: 60 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["acquired", "name"]) && hasTokenType(data, tokenType),
  },
  {
    name: "sync-unlock",
    endpoint: "/api/sync/unlock",
    method: "POST",
    body: { name: "test-lock", token: "invalid-token" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["released", "name"]) && hasTokenType(data, tokenType),
  },
  {
    name: "sync-check",
    endpoint: "/api/sync/check",
    method: "POST",
    body: { name: "test-lock" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["name", "locked"]) && hasTokenType(data, tokenType),
  },
  {
    name: "sync-extend",
    endpoint: "/api/sync/extend",
    method: "POST",
    body: { name: "test-lock", token: "invalid-token", ttl: 60 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["extended", "name"]) && hasTokenType(data, tokenType),
  },
  {
    name: "sync-list",
    endpoint: "/api/sync/list",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["locks", "count"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// QUEUE ENDPOINTS (5) - Durable Objects Job Queue
// =============================================================================

const queueEndpoints: TestConfig[] = [
  {
    name: "queue-push",
    endpoint: "/api/queue/push",
    method: "POST",
    body: { queue: "test-queue", payload: { task: "test" }, priority: 0 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["jobId", "queue", "position"]) && hasTokenType(data, tokenType),
  },
  {
    name: "queue-pop",
    endpoint: "/api/queue/pop",
    method: "POST",
    body: { queue: "test-queue", visibility: 60 },
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["jobId", "payload", "attempt"]) || hasField(data, "empty")) && hasTokenType(data, tokenType);
    },
  },
  {
    name: "queue-complete",
    endpoint: "/api/queue/complete",
    method: "POST",
    body: { jobId: "nonexistent-job" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["completed", "jobId"]) && hasTokenType(data, tokenType),
  },
  {
    name: "queue-fail",
    endpoint: "/api/queue/fail",
    method: "POST",
    body: { jobId: "nonexistent-job", error: "Test error" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["failed", "willRetry", "jobId"]) && hasTokenType(data, tokenType),
  },
  {
    name: "queue-status",
    endpoint: "/api/queue/status",
    method: "POST",
    body: { queue: "test-queue" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["queue", "pending", "processing", "completed"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// MEMORY ENDPOINTS (5) - Durable Objects Agent Memory System
// =============================================================================

const memoryEndpoints: TestConfig[] = [
  {
    name: "memory-store",
    endpoint: "/api/memory/store",
    method: "POST",
    body: {
      key: `test-memory-${Date.now()}`,
      content: "This is a test memory for the AI agent system.",
      metadata: { tags: ["test"], type: "note", importance: 5 },
      generateEmbedding: true,
    },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["key", "stored", "hasEmbedding"]) && hasTokenType(data, tokenType),
  },
  {
    name: "memory-recall",
    endpoint: "/api/memory/recall",
    method: "POST",
    body: { key: "nonexistent-memory" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "memory-search",
    endpoint: "/api/memory/search",
    method: "POST",
    body: { query: "test memory", limit: 10 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["query", "results", "count"]) && hasTokenType(data, tokenType),
  },
  {
    name: "memory-list",
    endpoint: "/api/memory/list",
    method: "POST",
    body: { limit: 10 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["memories", "total", "hasMore"]) && hasTokenType(data, tokenType),
  },
  {
    name: "memory-forget",
    endpoint: "/api/memory/forget",
    method: "POST",
    body: { key: "nonexistent-memory" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["deleted", "key"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// AGENT REGISTRY ENDPOINTS (16) - ERC-8004
// =============================================================================

const agentEndpoints: TestConfig[] = [
  {
    name: "agent-registry",
    endpoint: "/api/agent/registry",
    method: "GET",
    skipPayment: true,
    validateResponse: (data) =>
      hasFields(data, ["networks", "specification", "registries"]),
  },
  {
    name: "agent-info",
    endpoint: "/api/agent/info?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-owner",
    endpoint: "/api/agent/owner?agentId=0&network=testnet",
    method: "GET",
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-uri",
    endpoint: "/api/agent/uri?agentId=0&network=testnet",
    method: "GET",
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-metadata",
    endpoint: "/api/agent/metadata?network=testnet",
    method: "POST",
    body: { agentId: 0, key: "name" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-version",
    endpoint: "/api/agent/version?network=testnet",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["version", "registry"]) && hasTokenType(data, tokenType),
  },
  {
    name: "agent-lookup",
    endpoint: "/api/agent/lookup?network=testnet",
    method: "POST",
    body: { owner: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18", maxScan: 5 },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["owner", "agents", "count"]) && hasTokenType(data, tokenType),
  },
  {
    name: "reputation-summary",
    endpoint: "/api/agent/reputation/summary?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["count", "averageScore"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "reputation-feedback",
    endpoint: "/api/agent/reputation/feedback?network=testnet",
    method: "POST",
    body: { agentId: 0, client: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18", index: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "reputation-list",
    endpoint: "/api/agent/reputation/list?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["feedback", "count"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "reputation-clients",
    endpoint: "/api/agent/reputation/clients?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["clients", "count"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "reputation-auth-hash",
    endpoint: "/api/agent/reputation/auth-hash?network=testnet",
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
    endpoint: "/api/agent/validation/status?network=testnet",
    method: "POST",
    body: { requestHash: "0x" + "0".repeat(64) },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "validation-summary",
    endpoint: "/api/agent/validation/summary?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["count", "averageResponse"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "validation-list",
    endpoint: "/api/agent/validation/list?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return (hasFields(data, ["validations", "count"]) && hasTokenType(data, tokenType)) || hasField(data, "error");
    },
  },
  {
    name: "validation-requests",
    endpoint: "/api/agent/validation/requests?network=testnet",
    method: "POST",
    body: { validator: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["requests", "count"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// EXPORT COMBINED REGISTRY
// =============================================================================

export const ENDPOINT_REGISTRY: TestConfig[] = [
  ...stacksEndpoints,
  ...aiEndpoints,
  ...hashEndpoints,
  ...dataEndpoints,
  ...utilEndpoints,
  ...registryEndpoints,
  ...kvEndpoints,
  ...pasteEndpoints,
  ...counterEndpoints,
  ...sqlEndpoints,
  ...linksEndpoints,
  ...syncEndpoints,
  ...queueEndpoints,
  ...memoryEndpoints,
  ...agentEndpoints,
];

// Category mapping for filtered runs
export const ENDPOINT_CATEGORIES: Record<string, TestConfig[]> = {
  stacks: stacksEndpoints,
  ai: aiEndpoints,
  hash: hashEndpoints,
  data: dataEndpoints,
  util: utilEndpoints,
  registry: registryEndpoints,
  kv: kvEndpoints,
  paste: pasteEndpoints,
  counter: counterEndpoints,
  sql: sqlEndpoints,
  links: linksEndpoints,
  sync: syncEndpoints,
  queue: queueEndpoints,
  memory: memoryEndpoints,
  agent: agentEndpoints,
};

// Export counts for verification
export const ENDPOINT_COUNTS = {
  total: ENDPOINT_REGISTRY.length, // ~90 tests
  stacks: stacksEndpoints.length,  // 7
  ai: aiEndpoints.length,          // 13
  hash: hashEndpoints.length,      // 6
  data: dataEndpoints.length,      // 2 (free)
  util: utilEndpoints.length,      // 2
  registry: registryEndpoints.length, // 10
  kv: kvEndpoints.length,          // 4
  paste: pasteEndpoints.length,    // 3
  counter: counterEndpoints.length, // 6
  sql: sqlEndpoints.length,        // 3
  links: linksEndpoints.length,    // 5
  sync: syncEndpoints.length,      // 5
  queue: queueEndpoints.length,    // 5
  memory: memoryEndpoints.length,  // 5
  agent: agentEndpoints.length,    // 16
};
