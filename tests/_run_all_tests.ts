/**
 * X402 Endpoint Test Runner
 *
 * Runs E2E payment tests against all registered endpoints.
 *
 * Usage:
 *   bun run tests/_run_all_tests.ts                    # All endpoints, STX only
 *   bun run tests/_run_all_tests.ts --all-tokens       # All endpoints, all tokens
 *   bun run tests/_run_all_tests.ts --token=sBTC       # All endpoints, specific token
 *   bun run tests/_run_all_tests.ts --token=STX --token=sBTC  # Multiple specific tokens
 *   bun run tests/_run_all_tests.ts --category=stacks  # Single category
 *   bun run tests/_run_all_tests.ts --filter=sha256    # Filter by name
 *   bun run tests/_run_all_tests.ts --delay=1000       # 1s delay between tests
 *   bun run tests/_run_all_tests.ts --retries=3        # 3 retries for rate limits
 *   bun run tests/_run_all_tests.ts --reverse          # Run tests in reverse order
 *   bun run tests/_run_all_tests.ts --random           # Run tests in random order
 *
 * Environment:
 *   X402_CLIENT_PK      - Testnet mnemonic for payments (required)
 *   X402_NETWORK        - Network (default: testnet)
 *   VERBOSE=1           - Enable verbose logging
 *   TEST_DELAY_MS=500   - Delay between tests in ms (default: 500)
 *   TEST_MAX_RETRIES=2  - Max retries for rate-limited requests (default: 2)
 */

import type { TokenType, NetworkType } from "x402-stacks";
import { X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { ENDPOINT_REGISTRY, ENDPOINT_CATEGORIES, ENDPOINT_COUNTS } from "./endpoint-registry";
import type { TestConfig } from "./_test_generator";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
  createTestLogger,
} from "./_shared_utils";

// =============================================================================
// Error Types (mirror server-side types for parsing)
// =============================================================================

type PaymentErrorCode =
  | "FACILITATOR_UNAVAILABLE"
  | "FACILITATOR_ERROR"
  | "PAYMENT_INVALID"
  | "INSUFFICIENT_FUNDS"
  | "PAYMENT_EXPIRED"
  | "AMOUNT_TOO_LOW"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

interface PaymentErrorResponse {
  error: string;
  code: PaymentErrorCode;
  retryAfter?: number;
  tokenType: TokenType;
  resource: string;
  details?: {
    settleError?: string;
    settleReason?: string;
    settleStatus?: string;
    exceptionMessage?: string;
  };
}

function isPaymentErrorResponse(obj: unknown): obj is PaymentErrorResponse {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "error" in obj &&
    "code" in obj &&
    typeof (obj as PaymentErrorResponse).error === "string" &&
    typeof (obj as PaymentErrorResponse).code === "string"
  );
}

interface ParsedErrorResponse {
  message: string;
  details?: PaymentErrorResponse["details"];
  raw?: string;
}

function formatErrorResponse(status: number, body: string, retryAfter: string | null): ParsedErrorResponse {
  // Try to parse as structured error
  try {
    const parsed = JSON.parse(body);
    if (isPaymentErrorResponse(parsed)) {
      let msg = `[${parsed.code}] ${parsed.error}`;
      if (parsed.retryAfter || retryAfter) {
        msg += ` (retry after ${parsed.retryAfter || retryAfter}s)`;
      }
      return {
        message: msg,
        details: parsed.details,
        raw: body,
      };
    }
    // Legacy error format with just 'error' field
    if (parsed.error) {
      return { message: parsed.error.slice(0, 80), raw: body };
    }
  } catch {
    // Not JSON, return truncated text
  }
  return { message: body.slice(0, 80), raw: body };
}

// =============================================================================
// Configuration
// =============================================================================

interface RunConfig {
  tokens: TokenType[];
  category: string | null;
  filter: string | null;
  maxConsecutiveFailures: number;
  verbose: boolean;
  delayMs: number;        // Delay between tests (ms)
  maxRetries: number;     // Max retries for rate-limited requests
  order: "default" | "reverse" | "random";  // Test execution order
}

function parseArgs(): RunConfig {
  const args = process.argv.slice(2);
  const config: RunConfig = {
    tokens: ["STX"], // Default to single token
    category: null,
    filter: null,
    maxConsecutiveFailures: 5,
    verbose: process.env.VERBOSE === "1",
    delayMs: parseInt(process.env.TEST_DELAY_MS || "500", 10),  // Default 500ms between tests
    maxRetries: parseInt(process.env.TEST_MAX_RETRIES || "3", 10),  // Default 3 retries for transient errors
    order: "default",
  };

  // Track if --token= was explicitly specified (to clear default)
  let tokenSpecified = false;

  for (const arg of args) {
    if (arg === "--all-tokens") {
      config.tokens = ["STX", "sBTC", "USDCx"];
      tokenSpecified = true;
    } else if (arg.startsWith("--token=")) {
      const rawToken = arg.split("=")[1].toUpperCase();
      // Normalize token names (sBTC and USDCx have specific casing)
      const token = (rawToken === "SBTC" ? "sBTC" : rawToken === "USDCX" ? "USDCx" : rawToken) as TokenType;
      if (["STX", "sBTC", "USDCx"].includes(token)) {
        // On first --token=, clear the default; then accumulate
        if (!tokenSpecified) {
          config.tokens = [];
          tokenSpecified = true;
        }
        // Avoid duplicates
        if (!config.tokens.includes(token)) {
          config.tokens.push(token);
        }
      }
    } else if (arg.startsWith("--category=")) {
      config.category = arg.split("=")[1].toLowerCase();
    } else if (arg.startsWith("--filter=")) {
      config.filter = arg.split("=")[1].toLowerCase();
    } else if (arg.startsWith("--max-failures=")) {
      config.maxConsecutiveFailures = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--delay=")) {
      config.delayMs = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--retries=")) {
      config.maxRetries = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--verbose" || arg === "-v") {
      config.verbose = true;
    } else if (arg === "--reverse") {
      config.order = "reverse";
    } else if (arg === "--random") {
      config.order = "random";
    }
  }

  return config;
}

// =============================================================================
// Helpers
// =============================================================================

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fisher-Yates shuffle for random order
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Check if error is retryable (rate limit or transient)
function isRetryableError(status: number, errorCode?: string, errorMessage?: string): boolean {
  // HTTP status codes that indicate rate limiting or transient errors
  if ([429, 500, 502, 503, 504].includes(status)) return true;

  // Our custom error codes that are retryable
  const retryableCodes = [
    "NETWORK_ERROR",
    "FACILITATOR_UNAVAILABLE",
    "FACILITATOR_ERROR",
    "UNKNOWN_ERROR",  // Often transient payment processing issues
  ];
  if (errorCode && retryableCodes.includes(errorCode)) return true;

  // Check error message for rate limit / transient patterns
  if (errorMessage) {
    const lowerMsg = errorMessage.toLowerCase();
    const retryablePatterns = [
      "429",
      "rate limit",
      "too many requests",
      "settle",
      "failed",
      "timeout",
      "temporarily",
      "try again",
    ];
    if (retryablePatterns.some(pattern => lowerMsg.includes(pattern))) return true;
  }

  return false;
}

// =============================================================================
// X402 Payment Flow
// =============================================================================

interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

async function testEndpointWithToken(
  config: TestConfig,
  tokenType: TokenType,
  x402Client: X402PaymentClient,
  verbose: boolean,
  maxRetries: number = 2
): Promise<{ passed: boolean; error?: string }> {
  const logger = createTestLogger(config.name, verbose);
  const endpoint = config.endpoint.includes("?")
    ? `${config.endpoint}&tokenType=${tokenType}`
    : `${config.endpoint}?tokenType=${tokenType}`;
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;

  try {
    // For free endpoints, skip the payment flow entirely
    if (config.skipPayment) {
      logger.debug("1. Direct request (free endpoint)...");

      const res = await fetch(fullUrl, {
        method: config.method,
        headers: {
          ...(config.body ? { "Content-Type": "application/json" } : {}),
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      const allowedStatuses = [200, ...(config.allowedStatuses || [])];
      if (!allowedStatuses.includes(res.status)) {
        const text = await res.text();
        return { passed: false, error: `(${res.status}) ${text.slice(0, 100)}` };
      }

      // Validate response
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        logger.debug("Response", data);
        if (config.validateResponse(data, tokenType)) {
          return { passed: true };
        }
        return { passed: false, error: "Response validation failed" };
      }
      return { passed: true };
    }

    // Step 1: Initial request (expect 402)
    logger.debug("1. Initial request...");

    const initialRes = await fetch(fullUrl, {
      method: config.method,
      headers: {
        ...(config.body ? { "Content-Type": "application/json" } : {}),
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (initialRes.status !== 402) {
      const text = await initialRes.text();
      return { passed: false, error: `Expected 402, got ${initialRes.status}: ${text.slice(0, 100)}` };
    }

    const paymentReq: X402PaymentRequired = await initialRes.json();

    if (paymentReq.tokenType !== tokenType) {
      return { passed: false, error: `Token mismatch: expected ${tokenType}, got ${paymentReq.tokenType}` };
    }

    // Step 2: Sign payment
    logger.debug("2. Signing payment...");
    const signResult = await x402Client.signPayment(paymentReq);

    // Step 3: Retry with X-PAYMENT header (with retry logic for rate limits)
    let retryRes: Response | null = null;
    let lastError = "";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        logger.debug(`3. Retry attempt ${attempt}/${maxRetries}...`);
      } else {
        logger.debug("3. Retry with payment...");
      }

      retryRes = await fetch(fullUrl, {
        method: config.method,
        headers: {
          ...(config.body ? { "Content-Type": "application/json" } : {}),
          ...config.headers,
          "X-PAYMENT": signResult.signedTransaction,
          "X-PAYMENT-TOKEN-TYPE": tokenType,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      // Success - break out of retry loop
      // Accept 200, or any status in allowedStatuses
      const allowedStatuses = [200, ...(config.allowedStatuses || [])];
      if (allowedStatuses.includes(retryRes.status)) {
        break;
      }

      // Check if we should retry
      const errText = await retryRes.text();
      const retryAfterHeader = retryRes.headers.get("Retry-After");

      // Parse error to check if retryable
      let errorCode: string | undefined;
      let errorMessage: string | undefined;
      let bodyRetryAfter: number | undefined;
      try {
        const parsed = JSON.parse(errText);
        errorCode = parsed.code;
        errorMessage = parsed.error || parsed.details?.exceptionMessage || parsed.details?.settleError;
        bodyRetryAfter = parsed.retryAfter;
      } catch { /* not JSON */ }

      if (isRetryableError(retryRes.status, errorCode, errorMessage || errText) && attempt < maxRetries) {
        // Calculate delay: use Retry-After header, body retryAfter, or exponential backoff
        const retryAfterSecs = retryAfterHeader ? parseInt(retryAfterHeader, 10) : (bodyRetryAfter || 0);
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s
        const delayMs = retryAfterSecs > 0 ? retryAfterSecs * 1000 : backoffMs;

        logger.debug(`Rate limited (${retryRes.status}), waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
        continue;
      }

      // Not retryable or out of retries
      const parsedError = formatErrorResponse(retryRes.status, errText, retryAfterHeader);
      lastError = `(${retryRes.status}) ${parsedError.message}`;

      // Log detailed error info in verbose mode
      if (parsedError.details) {
        logger.debug("Error details:", parsedError.details);
      }
      if (parsedError.raw && parsedError.raw !== parsedError.message) {
        logger.debug("Raw response:", parsedError.raw);
      }
      break;
    }

    // Check if response status is acceptable
    const allowedStatuses = [200, ...(config.allowedStatuses || [])];
    if (!retryRes || !allowedStatuses.includes(retryRes.status)) {
      return { passed: false, error: lastError || "Request failed" };
    }

    // Step 4: Validate response
    const contentType = retryRes.headers.get("content-type") || "";
    const expectedContentType = config.expectedContentType || "application/json";

    // For non-JSON responses, just check content-type
    if (!contentType.includes("application/json")) {
      if (contentType.includes(expectedContentType.split("/")[0])) {
        return { passed: true };
      }
      return { passed: false, error: `Wrong content-type: expected ${expectedContentType}, got ${contentType}` };
    }

    // For JSON responses, validate the data
    const data = await retryRes.json();
    logger.debug("Response", data);

    if (config.validateResponse(data, tokenType)) {
      return { passed: true };
    }

    return { passed: false, error: "Response validation failed" };
  } catch (error) {
    return { passed: false, error: String(error) };
  }
}

// =============================================================================
// Test Runner
// =============================================================================

interface TestResult {
  name: string;
  tokenResults: Record<TokenType, { passed: boolean; error?: string }>;
}

interface RunStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  byToken: Record<TokenType, { passed: number; failed: number }>;
  failedTests: Array<{ name: string; token: TokenType; error: string }>;
}

async function runTests(runConfig: RunConfig): Promise<RunStats> {
  if (!X402_CLIENT_PK) {
    throw new Error("Set X402_CLIENT_PK env var with mnemonic");
  }

  // Validate network
  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    throw new Error(`Invalid X402_NETWORK: "${X402_NETWORK}". Must be "mainnet" or "testnet".`);
  }
  const network: NetworkType = X402_NETWORK;

  // Initialize wallet
  const { address, key } = await deriveChildAccount(
    network,
    X402_CLIENT_PK,
    0
  );

  const x402Client = new X402PaymentClient({
    network,
    privateKey: key,
  });

  // Select endpoints to test
  let endpoints: TestConfig[] = runConfig.category
    ? ENDPOINT_CATEGORIES[runConfig.category] || []
    : ENDPOINT_REGISTRY;

  if (runConfig.filter) {
    endpoints = endpoints.filter((e) =>
      e.name.toLowerCase().includes(runConfig.filter!)
    );
  }

  // Apply test ordering
  if (runConfig.order === "reverse") {
    endpoints = [...endpoints].reverse();
  } else if (runConfig.order === "random") {
    endpoints = shuffle(endpoints);
  }

  // Initialize stats
  const stats: RunStats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    byToken: {} as Record<TokenType, { passed: number; failed: number }>,
    failedTests: [],
  };

  for (const token of runConfig.tokens) {
    stats.byToken[token] = { passed: 0, failed: 0 };
  }

  // Print header
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  X402 ENDPOINT TEST RUNNER${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`  Wallet:     ${address}`);
  console.log(`  Network:    ${network}`);
  console.log(`  Server:     ${X402_WORKER_URL}`);
  console.log(`  Endpoints:  ${endpoints.length}`);
  console.log(`  Tokens:     ${runConfig.tokens.join(", ")}`);
  console.log(`  Total runs: ${endpoints.length * runConfig.tokens.length}`);
  console.log(`  Order:      ${runConfig.order}`);
  console.log(`  Delay:      ${runConfig.delayMs}ms between tests`);
  console.log(`  Retries:    ${runConfig.maxRetries} for rate-limited requests`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}\n`);

  // Track consecutive failures
  let consecutiveFailures = 0;

  // Run tests
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];

    // Check bail-out condition
    if (consecutiveFailures >= runConfig.maxConsecutiveFailures) {
      console.log(
        `\n${COLORS.red}${COLORS.bright}BAIL OUT: ${consecutiveFailures} consecutive failures${COLORS.reset}`
      );
      stats.skipped = (endpoints.length - i) * runConfig.tokens.length;
      break;
    }

    const progress = `[${i + 1}/${endpoints.length}]`;
    console.log(
      `${COLORS.bright}${progress}${COLORS.reset} ${COLORS.cyan}${endpoint.name}${COLORS.reset}`
    );

    let allPassed = true;
    const tokenResults: string[] = [];

    for (const token of runConfig.tokens) {
      stats.total++;

      const result = await testEndpointWithToken(
        endpoint,
        token,
        x402Client,
        runConfig.verbose,
        runConfig.maxRetries
      );

      if (result.passed) {
        stats.passed++;
        stats.byToken[token].passed++;
        tokenResults.push(`${COLORS.green}${token}:✓${COLORS.reset}`);
      } else {
        stats.failed++;
        stats.byToken[token].failed++;
        allPassed = false;
        tokenResults.push(`${COLORS.red}${token}:✗${COLORS.reset}`);
        stats.failedTests.push({
          name: endpoint.name,
          token,
          error: result.error || "Unknown error",
        });
      }
    }

    // Print token results
    console.log(`    ${tokenResults.join("  ")}`);

    // Delay between tests to avoid rate limiting
    if (runConfig.delayMs > 0 && i < endpoints.length - 1) {
      await sleep(runConfig.delayMs);
    }

    // Update consecutive failure count
    if (allPassed) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }

    // Brief delay between endpoints to avoid rate limiting
    await new Promise((r) => setTimeout(r, 100));
  }

  return stats;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const config = parseArgs();

  console.clear();

  try {
    const stats = await runTests(config);

    // Print summary
    console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
    console.log(`${COLORS.bright}  SUMMARY${COLORS.reset}`);
    console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

    const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : "0.0";
    const color = stats.failed === 0 ? COLORS.green : stats.passed > stats.failed ? COLORS.yellow : COLORS.red;

    console.log(`  ${color}${COLORS.bright}${stats.passed}/${stats.total} passed (${passRate}%)${COLORS.reset}`);

    if (stats.skipped > 0) {
      console.log(`  ${COLORS.yellow}${stats.skipped} skipped (bail-out)${COLORS.reset}`);
    }

    // Per-token breakdown
    console.log(`\n  By Token:`);
    for (const [token, tokenStats] of Object.entries(stats.byToken)) {
      const tokenTotal = tokenStats.passed + tokenStats.failed;
      const tokenRate = tokenTotal > 0 ? ((tokenStats.passed / tokenTotal) * 100).toFixed(0) : "0";
      const tokenColor = tokenStats.failed === 0 ? COLORS.green : COLORS.yellow;
      console.log(
        `    ${tokenColor}${token}: ${tokenStats.passed}/${tokenTotal} (${tokenRate}%)${COLORS.reset}`
      );
    }

    // Failed tests detail
    if (stats.failedTests.length > 0) {
      console.log(`\n  ${COLORS.red}Failed Tests:${COLORS.reset}`);
      for (const fail of stats.failedTests) {
        console.log(`    ${COLORS.red}✗${COLORS.reset} ${fail.name} [${fail.token}]`);
        console.log(`      ${COLORS.gray}${fail.error}${COLORS.reset}`);
      }
    }

    console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}\n`);

    // Exit with error code if any failures
    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${COLORS.red}${COLORS.bright}FATAL ERROR:${COLORS.reset}`, error);
    process.exit(1);
  }
}

main();
