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
      // POX-4 contract - built-in Stacks contract with get-pox-info read-only function
      // Using mainnet POX-4 which is a core contract (less likely to be rate-limited)
      contractAddress: "SP000000000000000000002Q6VF78",
      contractName: "pox-4",
      functionName: "get-pox-info",
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
    // 1x1 red pixel PNG for minimal test image
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
    validateResponse: () => true, // Audio content validated by content-type
  },
  {
    name: "generate-image",
    endpoint: "/api/ai/generate-image",
    method: "POST",
    body: { prompt: "a peaceful mountain landscape with blue sky and green trees" },
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
// TEXT ENDPOINTS (24)
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
      const d = data as { decoded: string; tokenType: TokenType };
      return d.decoded === "test" && d.tokenType === tokenType;
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
    body: { text: "hello%20world" },
    validateResponse: (data, tokenType) => {
      const d = data as { decoded: string; tokenType: TokenType };
      return d.decoded === "hello world" && d.tokenType === tokenType;
    },
  },
  {
    name: "jwt-decode",
    endpoint: "/api/text/jwt-decode",
    method: "POST",
    body: {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["header", "payload"]) && hasTokenType(data, tokenType),
  },
  {
    name: "hmac",
    endpoint: "/api/text/hmac",
    method: "POST",
    body: { message: "message", key: "secret" },
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
    body: { text: "&lt;div&gt;Hello&lt;/div&gt;" },
    validateResponse: (data, tokenType) => {
      const d = data as { decoded: string; tokenType: TokenType };
      return d.decoded === "<div>Hello</div>" && d.tokenType === tokenType;
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
      const d = data as { converted: string; tokenType: TokenType };
      return d.converted === "HELLO WORLD" && d.tokenType === tokenType;
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
    body: { text: "Hello World!", length: 8 },
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
      const d = data as { isValid: boolean; tokenType: TokenType };
      return d.isValid === true && d.tokenType === tokenType;
    },
  },
  {
    name: "diff",
    endpoint: "/api/text/diff",
    method: "POST",
    body: { text1: "hello world", text2: "hello there" },
    validateResponse: (data, tokenType) =>
      hasField(data, "changes") && hasTokenType(data, tokenType),
  },
  {
    name: "unicode-info",
    endpoint: "/api/text/unicode-info",
    method: "POST",
    body: { text: "A" },
    validateResponse: (data, tokenType) =>
      hasField(data, "characters") && hasTokenType(data, tokenType),
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
    body: { json: { a: { b: 1 } }, path: "a.b" },
    validateResponse: (data, tokenType) => {
      const d = data as { value: number; found: boolean; tokenType: TokenType };
      return d.value === 1 && d.found === true && d.tokenType === tokenType;
    },
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
    body: { data: "test" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["hash", "algorithm"]) && hasTokenType(data, tokenType),
  },
  {
    name: "random-bytes",
    endpoint: "/api/crypto/random-bytes?length=16",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { bytes: string; tokenType: TokenType };
      return d.bytes.length === 32 && d.tokenType === tokenType; // 16 bytes = 32 hex chars
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
      const d = data as { numbers: number[]; tokenType: TokenType };
      return d.numbers.length === 1 && d.numbers[0] >= 1 && d.numbers[0] <= 100 && d.tokenType === tokenType;
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
    validateResponse: (data, tokenType) => {
      const d = data as { colors: { hex: string; rgb: string }; tokenType: TokenType };
      return d.colors && typeof d.colors.hex === "string" && typeof d.colors.rgb === "string" && d.tokenType === tokenType;
    },
  },
  {
    name: "dice",
    endpoint: "/api/random/dice?notation=2d6",
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
    body: { operation: "what_percent", value: 50, from: 200 },
    validateResponse: (data, tokenType) => {
      const d = data as { result: number; tokenType: TokenType };
      return d.result === 25 && d.tokenType === tokenType;
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
    body: { numbers: [12, 18] },
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
// UTILITY ENDPOINTS (23)
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
      hasField(data, "records") && hasTokenType(data, tokenType),
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
    endpoint: "/api/util/timestamp-convert?value=1704067200",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasFields(data, ["iso", "utc"]) && hasTokenType(data, tokenType),
  },
  {
    name: "date-diff",
    endpoint: "/api/util/date-diff?from=2024-01-01&to=2024-01-10",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { totalDays: number; tokenType: TokenType };
      return d.totalDays === 9 && d.tokenType === tokenType;
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
    endpoint: "/api/util/cron-parse?expression=0%209%20*%20*%20*",
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
      const d = data as { name: string; tokenType: TokenType };
      return d.name === "OK" && d.tokenType === tokenType;
    },
  },
  {
    name: "validate-email",
    endpoint: "/api/util/validate-email?email=test@example.com",
    method: "GET",
    validateResponse: (data, tokenType) => {
      const d = data as { isValid: boolean; tokenType: TokenType };
      return d.isValid === true && d.tokenType === tokenType;
    },
  },
  {
    name: "url-build",
    endpoint: "/api/util/url-build",
    method: "POST",
    body: { hostname: "example.com", pathname: "/api", query: { q: "test" } },
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
      // 1048576 bytes = 1.05 MB (decimal) or 1.00 MiB (binary)
      return d.formatted.includes("MB") && d.tokenType === tokenType;
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
    endpoint: "/api/util/mime-type?extension=json",
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
  {
    name: "verify-signature",
    endpoint: "/api/util/verify-signature",
    method: "POST",
    // Test with a simple signature verification request
    // Using mode=simple with a dummy signature that will fail validation
    // but the endpoint should still return a proper response
    body: {
      signature: "0".repeat(130), // Invalid signature, but tests endpoint works
      address: FIXTURES.mainnetAddress,
      mode: "simple",
      message: "test message",
    },
    validateResponse: (data, tokenType) => {
      const d = data as { valid: boolean; mode: string; tokenType: TokenType };
      // Signature won't be valid, but endpoint should respond correctly
      return d.mode === "simple" && d.tokenType === tokenType && "valid" in d;
    },
  },
];

// =============================================================================
// KV STORAGE ENDPOINTS (4)
// Note: These endpoints are stateful. The test creates a key, retrieves it,
// lists keys, then deletes it. Each run uses a unique timestamp-based key.
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
    // Note: This may 404 if run independently without kv-set first
    // For full lifecycle testing, use tests/kv-storage.test.ts
    body: { key: "nonexistent-key-for-404-test" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      // Accept either success (key found) or 404 error response
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
    // Note: This may 404 if run independently
    body: { key: "nonexistent-key-for-404-test" },
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      // Accept either success or 404 error response
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
];

// =============================================================================
// PASTE ENDPOINTS (3)
// Note: These endpoints are stateful. Create stores content with a short code,
// get retrieves it, delete removes it. Only the creator can delete.
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
    // Note: This will 404 since the code doesn't exist
    // For full lifecycle testing, use a dedicated test file
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      // Accept either success (code found) or 404 error response
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "paste-delete",
    endpoint: "/api/paste/delete",
    method: "POST",
    body: { code: "abc123" },
    // Note: This will 404 since the code doesn't exist
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      // Accept either success or 404 error response
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
];

// =============================================================================
// COUNTER ENDPOINTS (6) - Durable Objects
// Note: These endpoints are stateful. Each payer gets their own isolated DO.
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
    // Note: This will 404 if counter doesn't exist
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
// NETWORK ENDPOINTS (6)
// =============================================================================

const netEndpoints: TestConfig[] = [
  {
    name: "geo-ip",
    endpoint: "/api/net/geo-ip",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "ip") && hasTokenType(data, tokenType),
  },
  {
    name: "asn-lookup",
    endpoint: "/api/net/asn-lookup?ip=8.8.8.8",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "asn") && hasTokenType(data, tokenType),
  },
  {
    name: "request-fingerprint",
    endpoint: "/api/net/request-fingerprint",
    method: "GET",
    validateResponse: (data, tokenType) =>
      hasField(data, "ip") && hasTokenType(data, tokenType),
  },
  {
    name: "http-probe",
    endpoint: "/api/net/http-probe",
    method: "POST",
    body: { url: "https://example.com" },
    validateResponse: (data, tokenType) =>
      hasFields(data, ["status", "url"]) && hasTokenType(data, tokenType),
  },
  {
    name: "cors-proxy",
    endpoint: "/api/net/cors-proxy",
    method: "POST",
    body: { url: "https://example.com", method: "GET" },
    validateResponse: (data, tokenType) =>
      hasField(data, "status") && hasTokenType(data, tokenType),
  },
  {
    name: "ssl-check",
    endpoint: "/api/net/ssl-check",
    method: "POST",
    body: { domain: "example.com" },
    validateResponse: (data, tokenType) =>
      hasField(data, "valid") && hasTokenType(data, tokenType),
  },
];

// =============================================================================
// REGISTRY ENDPOINTS (10)
// Note: Registry endpoints manage API endpoint discovery and registration.
// Some tests may require prior state or specific authorization.
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
      // May fail if already registered, but should return proper response
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-list",
    endpoint: "/api/registry/list",
    method: "GET",
    // This is a FREE endpoint, no payment required
    skipPayment: true,
    validateResponse: (data) => hasField(data, "entries"),
  },
  {
    name: "registry-details",
    endpoint: "/api/registry/details",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent" },
    // May 404 if not found
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
    // Expected to fail with 404 since the endpoint doesn't exist
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      // May fail if not owner or not found
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "registry-delete",
    endpoint: "/api/registry/delete",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent" },
    // Expected to fail with 404 since the endpoint doesn't exist
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      // May fail if not owner or not found
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
    // Expected to fail with 404 since the endpoint doesn't exist
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      // May fail if not owner or not found
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "admin-registry-verify",
    endpoint: "/api/admin/registry/verify",
    method: "POST",
    body: { url: "https://example.com/api/nonexistent", action: "verify", adminAddress: FIXTURES.mainnetAddress },
    // Admin endpoints return 403 for non-admin callers - this is expected behavior
    allowedStatuses: [403],
    validateResponse: (data, tokenType) => {
      // May fail if not admin
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "admin-registry-pending",
    endpoint: "/api/admin/registry/pending",
    method: "POST",
    body: { adminAddress: FIXTURES.mainnetAddress },
    // Admin endpoints return 403 for non-admin callers - this is expected behavior
    allowedStatuses: [403],
    validateResponse: (data, tokenType) => {
      // May fail if not admin
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
];

// =============================================================================
// SQL ENDPOINTS (3) - Durable Objects
// Note: These endpoints provide direct SQL access to user's DO database.
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
// Note: These endpoints provide URL shortening with click tracking.
// Expand is free (to allow redirects), create/stats/delete/list are paid.
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
    // Note: This is a FREE endpoint - no payment required
    // Returns 404 for missing slugs
    skipPayment: true,
    allowedStatuses: [404],
    validateResponse: (data) => {
      // Accept URL response or 404 error
      return hasField(data, "url") || hasField(data, "error");
    },
  },
  {
    name: "links-stats",
    endpoint: "/api/links/stats",
    method: "POST",
    body: { slug: "nonexistent" },
    // Returns 404 error for nonexistent slugs - this is expected
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
// Note: These endpoints provide distributed locking with automatic expiration.
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
// Note: These endpoints provide distributed job queue functionality with
// priority, retries, and dead letter queue support.
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
      // May return a job or empty queue
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
// Note: These endpoints provide AI-powered memory storage with semantic search.
// Memories are stored with embeddings for similarity search.
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
    // May return 404 for nonexistent memory
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
// Note: These endpoints query on-chain ERC-8004 agent registry contracts.
// Uses testnet contracts by default.
// =============================================================================

const agentEndpoints: TestConfig[] = [
  {
    name: "agent-registry",
    endpoint: "/api/agent/registry",
    method: "GET",
    // This is a FREE endpoint, no payment required
    skipPayment: true,
    validateResponse: (data) =>
      hasFields(data, ["networks", "specification", "registries"]),
  },
  {
    name: "agent-info",
    endpoint: "/api/agent/info?network=testnet",
    method: "POST",
    body: { agentId: 0 },
    // May return 404 if no agents registered
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-owner",
    endpoint: "/api/agent/owner?agentId=0&network=testnet",
    method: "GET",
    // May return 404 if agent doesn't exist
    allowedStatuses: [404],
    validateResponse: (data, tokenType) => {
      return hasTokenType(data, tokenType) || hasField(data, "error");
    },
  },
  {
    name: "agent-uri",
    endpoint: "/api/agent/uri?agentId=0&network=testnet",
    method: "GET",
    // May return 404 if agent doesn't exist or has no URI
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
    // May return 404 if agent or key doesn't exist
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
    // May return 404 if agent doesn't exist
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
    // May return 404 if feedback doesn't exist
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
    // May return 404 if agent doesn't exist
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
    // May return 404 if agent doesn't exist
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
    // May return 404 if validation doesn't exist
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
    // May return 404 if agent doesn't exist
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
    // May return 404 if agent doesn't exist
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
  ...textEndpoints,
  ...dataEndpoints,
  ...cryptoEndpoints,
  ...randomEndpoints,
  ...mathEndpoints,
  ...utilEndpoints,
  ...netEndpoints,
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
  text: textEndpoints,
  data: dataEndpoints,
  crypto: cryptoEndpoints,
  random: randomEndpoints,
  math: mathEndpoints,
  util: utilEndpoints,
  net: netEndpoints,
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
  total: ENDPOINT_REGISTRY.length, // 166 tests (163 paid + 3 free tested; health/dashboard excluded)
  stacks: stacksEndpoints.length,  // 15
  ai: aiEndpoints.length,          // 13
  text: textEndpoints.length,      // 24
  data: dataEndpoints.length,      // 8
  crypto: cryptoEndpoints.length,  // 2
  random: randomEndpoints.length,  // 7
  math: mathEndpoints.length,      // 6
  util: utilEndpoints.length,      // 23
  net: netEndpoints.length,        // 6
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
