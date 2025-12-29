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
  bnsAddress: "SP1JTCR202ECC6333N7ZXD7MK7E3ZTEEE1MJ73C60", // Has BNS name

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
// STACKS ENDPOINTS (15)
// =============================================================================

const stacksEndpoints: TestConfig[] = [
  {
    name: "get-bns-name",
    endpoint: `/api/stacks/get-bns-name/${FIXTURES.bnsAddress}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "name") && hasTokenType(data, tokenType),
  },
  {
    name: "validate-address",
    endpoint: `/api/stacks/validate-address/${FIXTURES.mainnetAddress}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "valid") && hasTokenType(data, tokenType),
  },
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
    name: "contract-source",
    endpoint: `/api/stacks/contract-source/${FIXTURES.mainnetContract}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["source", "hash", "contractId"]) && hasTokenType(data, tokenType),
  },
  {
    name: "contract-abi",
    endpoint: `/api/stacks/contract-abi/${FIXTURES.mainnetContract}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "abi") && hasTokenType(data, tokenType),
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
      // Valid STX transfer transaction hex
      hex: "0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000003200000000000000b400008537046ff1008368baaa3ff2235122c556b89dad4f9df0639b924cf32a44b866497e49846b24191e711b21faaae96ca0542e4a140168484740b94211cececb3303020000000000051ab52c45b1a7977204f17ac0b6f48306aea2dbb8e9000000000007a12046617563657400000000000000000000000000000000000000000000000000000000",
    },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["version", "payloadType", "payload"]) && hasTokenType(data, tokenType),
  },
  {
    name: "call-readonly",
    endpoint: "/api/stacks/call-readonly",
    method: "POST",
    body: {
      // USDA token - well-known SIP-010 token with get-name read-only function
      contractAddress: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
      contractName: "usda-token",
      functionName: "get-name",
      functionArgs: [],
    },
    validateResponse: (data, tokenType) =>
      hasField(data, "result") && hasTokenType(data, tokenType),
  },
  {
    name: "stx-balance",
    endpoint: `/api/stacks/stx-balance/${FIXTURES.mainnetAddress}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["balance", "balanceFormatted"]) && hasTokenType(data, tokenType),
  },
  {
    name: "block-height",
    endpoint: "/api/stacks/block-height",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["stacksBlockHeight", "burnBlockHeight"]) && hasTokenType(data, tokenType),
  },
  {
    name: "ft-balance",
    endpoint: `/api/stacks/ft-balance/${FIXTURES.mainnetAddress}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "tokens") && hasTokenType(data, tokenType),
  },
  {
    name: "nft-holdings",
    endpoint: `/api/stacks/nft-holdings/${FIXTURES.mainnetAddress}`,
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "nfts") && hasTokenType(data, tokenType),
  },
  {
    name: "tx-status",
    // Real mainnet transaction hash
    endpoint: "/api/stacks/tx-status/0xb2fa5638ebc5715a9e2f01a4e0d7b3183aacdc8f9c0c3fea0d2f73d28c9bc066",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "status") && hasTokenType(data, tokenType),
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
    body: { imageUrl: "https://picsum.photos/200" },
    validateResponse: (data, tokenType) =>
      hasField(data, "description") && hasTokenType(data, tokenType),
  },
  {
    name: "tts",
    endpoint: "/api/ai/tts",
    method: "POST",
    body: { text: "Hello world" },
    expectedContentType: "audio",
    validateResponse: () => true, // Audio content validated by content-type
  },
  {
    name: "generate-image",
    endpoint: "/api/ai/generate-image",
    method: "POST",
    body: { prompt: "a simple red circle" },
    expectedContentType: "image",
    validateResponse: () => true, // Image content validated by content-type
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
    body: { text: "Hello world", targetLanguage: "es" },
    validateResponse: (data, tokenType) =>
      hasField(data, "translation") && hasTokenType(data, tokenType),
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
// TEXT ENDPOINTS (25)
// =============================================================================

const textEndpoints: TestConfig[] = [
  {
    name: "base64-encode",
    endpoint: "/api/text/base64-encode",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) => {
      const d = data as { encoded: string; tokenType: TokenType };
      return d.encoded === FIXTURES.base64OfTest && d.tokenType === tokenType;
    },
  },
  {
    name: "base64-decode",
    endpoint: "/api/text/base64-decode",
    method: "POST",
    body: { encoded: FIXTURES.base64OfTest },
    validateResponse: (data, tokenType) => {
      const d = data as { text: string; tokenType: TokenType };
      return d.text === "test" && d.tokenType === tokenType;
    },
  },
  {
    name: "sha256",
    endpoint: "/api/text/sha256",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) => {
      const d = data as { hash: string; tokenType: TokenType };
      return d.hash === FIXTURES.sha256OfTest && d.tokenType === tokenType;
    },
  },
  {
    name: "sha512",
    endpoint: "/api/text/sha512",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "keccak256",
    endpoint: "/api/text/keccak256",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "hash160",
    endpoint: "/api/text/hash160",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "url-encode",
    endpoint: "/api/text/url-encode",
    method: "POST",
    body: { text: "hello world" },
    validateResponse: (data, tokenType) => {
      const d = data as { encoded: string; tokenType: TokenType };
      return d.encoded === "hello%20world" && d.tokenType === tokenType;
    },
  },
  {
    name: "url-decode",
    endpoint: "/api/text/url-decode",
    method: "POST",
    body: { encoded: "hello%20world" },
    validateResponse: (data, tokenType) => {
      const d = data as { text: string; tokenType: TokenType };
      return d.text === "hello world" && d.tokenType === tokenType;
    },
  },
  {
    name: "jwt-decode",
    endpoint: "/api/text/jwt-decode",
    method: "POST",
    body: {
      jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["header", "payload"]) && hasTokenType(data, tokenType),
  },
  {
    name: "hmac",
    endpoint: "/api/text/hmac",
    method: "POST",
    body: { text: "message", key: "secret" },
    validateResponse: (data, tokenType) =>
      hasField(data, "hmac") && hasTokenType(data, tokenType),
  },
  {
    name: "html-encode",
    endpoint: "/api/text/html-encode",
    method: "POST",
    body: { text: "<div>Hello</div>" },
    validateResponse: (data, tokenType) => {
      const d = data as { encoded: string; tokenType: TokenType };
      return d.encoded.includes("&lt;") && d.tokenType === tokenType;
    },
  },
  {
    name: "html-decode",
    endpoint: "/api/text/html-decode",
    method: "POST",
    body: { encoded: "&lt;div&gt;Hello&lt;/div&gt;" },
    validateResponse: (data, tokenType) => {
      const d = data as { text: string; tokenType: TokenType };
      return d.text === "<div>Hello</div>" && d.tokenType === tokenType;
    },
  },
  {
    name: "hex-encode",
    endpoint: "/api/text/hex-encode",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) => {
      const d = data as { hex: string; tokenType: TokenType };
      return d.hex === "74657374" && d.tokenType === tokenType;
    },
  },
  {
    name: "hex-decode",
    endpoint: "/api/text/hex-decode",
    method: "POST",
    body: { hex: "74657374" },
    validateResponse: (data, tokenType) => {
      const d = data as { text: string; tokenType: TokenType };
      return d.text === "test" && d.tokenType === tokenType;
    },
  },
  {
    name: "case-convert",
    endpoint: "/api/text/case-convert",
    method: "POST",
    body: { text: "hello world", case: "upper" },
    validateResponse: (data, tokenType) => {
      const d = data as { result: string; tokenType: TokenType };
      return d.result === "HELLO WORLD" && d.tokenType === tokenType;
    },
  },
  {
    name: "slug",
    endpoint: "/api/text/slug",
    method: "POST",
    body: { text: "Hello World!" },
    validateResponse: (data, tokenType) => {
      const d = data as { slug: string; tokenType: TokenType };
      return d.slug === "hello-world" && d.tokenType === tokenType;
    },
  },
  {
    name: "word-count",
    endpoint: "/api/text/word-count",
    method: "POST",
    body: { text: "Hello world test" },
    validateResponse: (data, tokenType) => {
      const d = data as { words: number; tokenType: TokenType };
      return d.words === 3 && d.tokenType === tokenType;
    },
  },
  {
    name: "reverse",
    endpoint: "/api/text/reverse",
    method: "POST",
    body: { text: "hello" },
    validateResponse: (data, tokenType) => {
      const d = data as { reversed: string; tokenType: TokenType };
      return d.reversed === "olleh" && d.tokenType === tokenType;
    },
  },
  {
    name: "truncate",
    endpoint: "/api/text/truncate",
    method: "POST",
    body: { text: "Hello World!", maxLength: 5 },
    validateResponse: (data, tokenType) =>
      hasField(data, "truncated") && hasTokenType(data, tokenType),
  },
  {
    name: "regex-test",
    endpoint: "/api/text/regex-test",
    method: "POST",
    body: { text: "test@example.com", pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$" },
    validateResponse: (data, tokenType) => {
      const d = data as { matches: boolean; tokenType: TokenType };
      return d.matches === true && d.tokenType === tokenType;
    },
  },
  {
    name: "rot13",
    endpoint: "/api/text/rot13",
    method: "POST",
    body: { text: "hello" },
    validateResponse: (data, tokenType) => {
      const d = data as { result: string; tokenType: TokenType };
      return d.result === "uryyb" && d.tokenType === tokenType;
    },
  },
  {
    name: "lorem-ipsum",
    endpoint: "/api/text/lorem-ipsum",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "text") && hasTokenType(data, tokenType),
  },
  {
    name: "validate-url",
    endpoint: "/api/text/validate-url?url=https://example.com",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { valid: boolean; tokenType: TokenType };
      return d.valid === true && d.tokenType === tokenType;
    },
  },
  {
    name: "diff",
    endpoint: "/api/text/diff",
    method: "POST",
    body: { original: "hello world", modified: "hello there" },
    validateResponse: (data, tokenType) =>
      hasField(data, "diff") && hasTokenType(data, tokenType),
  },
  {
    name: "unicode-info",
    endpoint: "/api/text/unicode-info?char=A",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["codePoint", "name"]) && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// DATA ENDPOINTS (8)
// =============================================================================

const dataEndpoints: TestConfig[] = [
  {
    name: "csv-to-json",
    endpoint: "/api/data/csv-to-json",
    method: "POST",
    body: { csv: FIXTURES.simpleCsv },
    validateResponse: (data, tokenType) => {
      const d = data as { data: unknown[]; rows: number; tokenType: TokenType };
      return d.rows === 2 && d.tokenType === tokenType;
    },
  },
  {
    name: "json-to-csv",
    endpoint: "/api/data/json-to-csv",
    method: "POST",
    body: { data: [{ name: "Alice", age: 30 }] },
    validateResponse: (data, tokenType) =>
      hasField(data, "csv") && hasTokenType(data, tokenType),
  },
  {
    name: "json-format",
    endpoint: "/api/data/json-format",
    method: "POST",
    body: { json: '{"a":1}' },
    validateResponse: (data, tokenType) =>
      hasField(data, "formatted") && hasTokenType(data, tokenType),
  },
  {
    name: "json-minify",
    endpoint: "/api/data/json-minify",
    method: "POST",
    body: { json: '{\n  "a": 1\n}' },
    validateResponse: (data, tokenType) => {
      const d = data as { minified: string; tokenType: TokenType };
      return d.minified === '{"a":1}' && d.tokenType === tokenType;
    },
  },
  {
    name: "json-validate",
    endpoint: "/api/data/json-validate",
    method: "POST",
    body: { json: '{"valid": true}' },
    validateResponse: (data, tokenType) => {
      const d = data as { valid: boolean; tokenType: TokenType };
      return d.valid === true && d.tokenType === tokenType;
    },
  },
  {
    name: "json-path",
    endpoint: "/api/data/json-path",
    method: "POST",
    body: { json: { a: { b: 1 } }, path: "$.a.b" },
    validateResponse: (data, tokenType) =>
      hasField(data, "result") && hasTokenType(data, tokenType),
  },
  {
    name: "json-flatten",
    endpoint: "/api/data/json-flatten",
    method: "POST",
    body: { json: { a: { b: 1 } } },
    validateResponse: (data, tokenType) =>
      hasField(data, "flattened") && hasTokenType(data, tokenType),
  },
  {
    name: "json-merge",
    endpoint: "/api/data/json-merge",
    method: "POST",
    body: { objects: [{ a: 1 }, { b: 2 }] },
    validateResponse: (data, tokenType) =>
      hasField(data, "merged") && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// CRYPTO ENDPOINTS (2)
// =============================================================================

const cryptoEndpoints: TestConfig[] = [
  {
    name: "ripemd160",
    endpoint: "/api/crypto/ripemd160",
    method: "POST",
    body: { text: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "random-bytes",
    endpoint: "/api/crypto/random-bytes?length=16",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { hex: string; tokenType: TokenType };
      return d.hex.length === 32 && d.tokenType === tokenType; // 16 bytes = 32 hex chars
    },
  },
];

// =============================================================================
// RANDOM ENDPOINTS (7)
// =============================================================================

const randomEndpoints: TestConfig[] = [
  {
    name: "uuid",
    endpoint: "/api/random/uuid",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { uuid: string; tokenType: TokenType };
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(d.uuid) && d.tokenType === tokenType;
    },
  },
  {
    name: "number",
    endpoint: "/api/random/number?min=1&max=100",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { number: number; tokenType: TokenType };
      return d.number >= 1 && d.number <= 100 && d.tokenType === tokenType;
    },
  },
  {
    name: "string",
    endpoint: "/api/random/string?length=10",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { string: string; tokenType: TokenType };
      return d.string.length === 10 && d.tokenType === tokenType;
    },
  },
  {
    name: "password",
    endpoint: "/api/random/password?length=16",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { password: string; tokenType: TokenType };
      return d.password.length === 16 && d.tokenType === tokenType;
    },
  },
  {
    name: "color",
    endpoint: "/api/random/color",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hex", "rgb"]) && hasTokenType(data, tokenType),
  },
  {
    name: "dice",
    endpoint: "/api/random/dice?count=2&sides=6",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { rolls: number[]; tokenType: TokenType };
      return d.rolls.length === 2 && d.tokenType === tokenType;
    },
  },
  {
    name: "shuffle",
    endpoint: "/api/random/shuffle",
    method: "POST",
    body: { items: [1, 2, 3, 4, 5] },
    validateResponse: (data, tokenType) => {
      const d = data as { shuffled: number[]; tokenType: TokenType };
      return d.shuffled.length === 5 && d.tokenType === tokenType;
    },
  },
];

// =============================================================================
// MATH ENDPOINTS (6)
// =============================================================================

const mathEndpoints: TestConfig[] = [
  {
    name: "calculate",
    endpoint: "/api/math/calculate",
    method: "POST",
    body: { expression: "2 + 2" },
    validateResponse: (data, tokenType) => {
      const d = data as { result: number; tokenType: TokenType };
      return d.result === 4 && d.tokenType === tokenType;
    },
  },
  {
    name: "percentage",
    endpoint: "/api/math/percentage",
    method: "POST",
    body: { value: 50, total: 200 },
    validateResponse: (data, tokenType) => {
      const d = data as { percentage: number; tokenType: TokenType };
      return d.percentage === 25 && d.tokenType === tokenType;
    },
  },
  {
    name: "statistics",
    endpoint: "/api/math/statistics",
    method: "POST",
    body: { numbers: [1, 2, 3, 4, 5] },
    validateResponse: (data, tokenType) => {
      const d = data as { mean: number; tokenType: TokenType };
      return d.mean === 3 && d.tokenType === tokenType;
    },
  },
  {
    name: "prime-check",
    endpoint: "/api/math/prime-check?number=17",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { isPrime: boolean; tokenType: TokenType };
      return d.isPrime === true && d.tokenType === tokenType;
    },
  },
  {
    name: "gcd-lcm",
    endpoint: "/api/math/gcd-lcm",
    method: "POST",
    body: { a: 12, b: 18 },
    validateResponse: (data, tokenType) => {
      const d = data as { gcd: number; lcm: number; tokenType: TokenType };
      return d.gcd === 6 && d.lcm === 36 && d.tokenType === tokenType;
    },
  },
  {
    name: "factorial",
    endpoint: "/api/math/factorial?n=5",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { result: number; tokenType: TokenType };
      return d.result === 120 && d.tokenType === tokenType;
    },
  },
];

// =============================================================================
// UTILITY ENDPOINTS (22)
// =============================================================================

const utilEndpoints: TestConfig[] = [
  {
    name: "timestamp",
    endpoint: "/api/util/timestamp",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["unix", "iso", "utc"]) && hasTokenType(data, tokenType),
  },
  {
    name: "dns-lookup",
    endpoint: "/api/util/dns-lookup?domain=google.com",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "addresses") && hasTokenType(data, tokenType),
  },
  {
    name: "ip-info",
    endpoint: "/api/util/ip-info",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "ip") && hasTokenType(data, tokenType),
  },
  {
    name: "qr-generate",
    endpoint: "/api/util/qr-generate",
    method: "POST",
    body: { data: "https://example.com", format: "base64" },
    validateResponse: (data, tokenType) =>
      hasField(data, "base64") && hasTokenType(data, tokenType),
  },
  {
    name: "timestamp-convert",
    endpoint: "/api/util/timestamp-convert?timestamp=1704067200",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["iso", "utc"]) && hasTokenType(data, tokenType),
  },
  {
    name: "date-diff",
    endpoint: "/api/util/date-diff?date1=2024-01-01&date2=2024-01-10",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { days: number; tokenType: TokenType };
      return d.days === 9 && d.tokenType === tokenType;
    },
  },
  {
    name: "date-add",
    endpoint: "/api/util/date-add",
    method: "POST",
    body: { date: "2024-01-01", add: { days: 5 } },
    validateResponse: (data, tokenType) =>
      hasField(data, "result") && hasTokenType(data, tokenType),
  },
  {
    name: "cron-parse",
    endpoint: "/api/util/cron-parse?cron=0%209%20*%20*%20*",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "description") && hasTokenType(data, tokenType),
  },
  {
    name: "user-agent-parse",
    endpoint: "/api/util/user-agent-parse?ua=Mozilla/5.0%20Chrome/120.0.0.0",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "browser") && hasTokenType(data, tokenType),
  },
  {
    name: "url-parse",
    endpoint: "/api/util/url-parse?url=https://example.com/path?q=1",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["protocol", "host", "pathname"]) && hasTokenType(data, tokenType),
  },
  {
    name: "color-convert",
    endpoint: "/api/util/color-convert?color=%23ff0000",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hex", "rgb", "hsl"]) && hasTokenType(data, tokenType),
  },
  {
    name: "markdown-to-html",
    endpoint: "/api/util/markdown-to-html",
    method: "POST",
    body: { markdown: "# Hello\n\nWorld" },
    validateResponse: (data, tokenType) => {
      const d = data as { html: string; tokenType: TokenType };
      return d.html.includes("<h1>") && d.tokenType === tokenType;
    },
  },
  {
    name: "http-status",
    endpoint: "/api/util/http-status?code=200",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { message: string; tokenType: TokenType };
      return d.message === "OK" && d.tokenType === tokenType;
    },
  },
  {
    name: "validate-email",
    endpoint: "/api/util/validate-email?email=test@example.com",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { valid: boolean; tokenType: TokenType };
      return d.valid === true && d.tokenType === tokenType;
    },
  },
  {
    name: "url-build",
    endpoint: "/api/util/url-build",
    method: "POST",
    body: { base: "https://example.com", path: "/api", params: { q: "test" } },
    validateResponse: (data, tokenType) =>
      hasField(data, "url") && hasTokenType(data, tokenType),
  },
  {
    name: "html-to-text",
    endpoint: "/api/util/html-to-text",
    method: "POST",
    body: { html: "<p>Hello <b>World</b></p>" },
    validateResponse: (data, tokenType) =>
      hasField(data, "text") && hasTokenType(data, tokenType),
  },
  {
    name: "base64-image",
    endpoint: "/api/util/base64-image?url=https://picsum.photos/50",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "base64") && hasTokenType(data, tokenType),
  },
  {
    name: "bytes-format",
    endpoint: "/api/util/bytes-format?bytes=1048576",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { formatted: string; tokenType: TokenType };
      return d.formatted === "1 MB" && d.tokenType === tokenType;
    },
  },
  {
    name: "slugify",
    endpoint: "/api/util/slugify",
    method: "POST",
    body: { text: "Hello World!" },
    validateResponse: (data, tokenType) => {
      const d = data as { slug: string; tokenType: TokenType };
      return d.slug === "hello-world" && d.tokenType === tokenType;
    },
  },
  {
    name: "mime-type",
    endpoint: "/api/util/mime-type?filename=test.json",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { mimeType: string; tokenType: TokenType };
      return d.mimeType === "application/json" && d.tokenType === tokenType;
    },
  },
  {
    name: "regex-escape",
    endpoint: "/api/util/regex-escape",
    method: "POST",
    body: { text: "hello.world" },
    validateResponse: (data, tokenType) => {
      const d = data as { escaped: string; tokenType: TokenType };
      return d.escaped === "hello\\.world" && d.tokenType === tokenType;
    },
  },
  {
    name: "string-distance",
    endpoint: "/api/util/string-distance",
    method: "POST",
    body: { string1: "kitten", string2: "sitting" },
    validateResponse: (data, tokenType) => {
      const d = data as { levenshtein: number; tokenType: TokenType };
      return d.levenshtein === 3 && d.tokenType === tokenType;
    },
  },
];

// =============================================================================
// EXPORT COMBINED REGISTRY
// =============================================================================

export const ENDPOINT_REGISTRY: TestConfig[] = [
  ...stacksEndpoints,
  ...aiEndpoints,
  ...textEndpoints,
  ...dataEndpoints,
  ...cryptoEndpoints,
  ...randomEndpoints,
  ...mathEndpoints,
  ...utilEndpoints,
];

// Category mapping for filtered runs
export const ENDPOINT_CATEGORIES: Record<string, TestConfig[]> = {
  stacks: stacksEndpoints,
  ai: aiEndpoints,
  text: textEndpoints,
  data: dataEndpoints,
  crypto: cryptoEndpoints,
  random: randomEndpoints,
  math: mathEndpoints,
  util: utilEndpoints,
};

// Export counts for verification
export const ENDPOINT_COUNTS = {
  total: ENDPOINT_REGISTRY.length,
  stacks: stacksEndpoints.length,
  ai: aiEndpoints.length,
  text: textEndpoints.length,
  data: dataEndpoints.length,
  crypto: cryptoEndpoints.length,
  random: randomEndpoints.length,
  math: mathEndpoints.length,
  util: utilEndpoints.length,
};
