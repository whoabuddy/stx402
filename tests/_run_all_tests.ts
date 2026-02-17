/**
 * X402 V2 Endpoint Test Runner
 *
 * Runs E2E payment tests against all registered endpoints using the V2 protocol.
 *
 * Modes:
 *   --mode=quick  (default)  Run stateless endpoints only (fast, no cleanup needed)
 *   --mode=full             Run stateless + all lifecycle tests for stateful endpoints
 *
 * Usage:
 *   bun run tests/_run_all_tests.ts                    # Quick mode, STX only
 *   bun run tests/_run_all_tests.ts --mode=full        # Full mode with lifecycle tests
 *   bun run tests/_run_all_tests.ts --all-tokens       # All endpoints, all tokens
 *   bun run tests/_run_all_tests.ts --token=sBTC       # All endpoints, specific token
 *   bun run tests/_run_all_tests.ts --category=agent   # Single stateless category
 *   bun run tests/_run_all_tests.ts --category=links   # Runs links lifecycle test
 *   bun run tests/_run_all_tests.ts --category=info    # Runs info endpoint tests (free)
 *   bun run tests/_run_all_tests.ts --filter=sha256    # Filter by name
 *   bun run tests/_run_all_tests.ts --delay=1000       # 1s delay between tests
 *   bun run tests/_run_all_tests.ts --retries=3        # 3 retries for rate limits
 *
 * Randomization (for cron variance):
 *   bun run tests/_run_all_tests.ts --sample=5         # Run 5 random stateless endpoints
 *   bun run tests/_run_all_tests.ts --random-lifecycle=2  # Run 2 random lifecycle categories
 *   bun run tests/_run_all_tests.ts --random-token     # Pick one random token (STX/sBTC/USDCx)
 *   bun run tests/_run_all_tests.ts --mode=full --sample=5 --random-lifecycle=2 --random-token
 *
 * Environment:
 *   X402_CLIENT_PK      - Testnet mnemonic for payments (required)
 *   X402_NETWORK        - Network (default: testnet)
 *   VERBOSE=1           - Enable verbose logging
 *   TEST_DELAY_MS=500   - Delay between tests in ms (default: 500)
 *   TEST_MAX_RETRIES=2  - Max retries for rate-limited requests (default: 2)
 */

import { X402PaymentClient, X402_HEADERS } from "x402-stacks";
import type { TokenType, NetworkType, PaymentRequiredV2 } from "x402-stacks";
import { deriveChildAccount } from "./_shared_wallet";
import {
  STATELESS_ENDPOINTS,
  ENDPOINT_CATEGORIES,
  STATEFUL_CATEGORIES,
  ENDPOINT_COUNTS,
} from "./endpoint-registry";
import type { TestConfig } from "./_test_generator";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
  TEST_TOKENS,
  createTestLogger,
  isNonceConflict,
  isRetryableError,
  sleep,
  buildPaymentPayloadV2,
  sampleArray,
  pickRandom,
} from "./_shared_utils";
import type {
  PaymentErrorCode,
  PaymentErrorResponse,
} from "../src/middleware/x402-stacks";

// Import lifecycle test runners
import { runRegistryLifecycle } from "./registry-lifecycle.test";
import { runLinksLifecycle } from "./links-lifecycle.test";
import { runAgentLifecycle } from "./agent-registry.test";
import { runInfoEndpointTests } from "./info-endpoints.test";

// =============================================================================
// Lifecycle Test Mapping
// =============================================================================

const LIFECYCLE_RUNNERS: Record<string, (verbose?: boolean) => Promise<{ passed: number; total: number; success: boolean }>> = {
  info: runInfoEndpointTests,
  registry: runRegistryLifecycle,
  links: runLinksLifecycle,
  agent: runAgentLifecycle,
};

// =============================================================================
// Error Types
// =============================================================================

// Type guard for PaymentErrorResponse (imported from middleware)
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
  try {
    const parsed = JSON.parse(body);
    if (isPaymentErrorResponse(parsed)) {
      let msg = `[${parsed.code}] ${parsed.error}`;
      if (parsed.retryAfter || retryAfter) {
        msg += ` (retry after ${parsed.retryAfter || retryAfter}s)`;
      }
      return { message: msg, details: parsed.details, raw: body };
    }
    if (parsed.error) {
      return { message: parsed.error.slice(0, 80), raw: body };
    }
  } catch { /* not JSON */ }
  return { message: body.slice(0, 80), raw: body };
}

// =============================================================================
// Configuration
// =============================================================================

type TestMode = "quick" | "full";

interface RunConfig {
  mode: TestMode;
  tokens: TokenType[];
  category: string | null;
  filter: string | null;
  maxConsecutiveFailures: number;
  verbose: boolean;
  delayMs: number;
  maxRetries: number;
  // Randomization options
  sampleSize: number | null; // --sample=N: run N random stateless endpoints
  randomLifecycleCount: number | null; // --random-lifecycle=N: run N random lifecycle categories
  randomToken: boolean; // --random-token: pick one random token
}

function parseArgs(): RunConfig {
  const args = process.argv.slice(2);
  const config: RunConfig = {
    mode: "quick",
    tokens: ["STX"],
    category: null,
    filter: null,
    maxConsecutiveFailures: 5,
    verbose: process.env.VERBOSE === "1",
    delayMs: parseInt(process.env.TEST_DELAY_MS || "500", 10),
    maxRetries: parseInt(process.env.TEST_MAX_RETRIES || "3", 10),
    // Randomization defaults
    sampleSize: null,
    randomLifecycleCount: null,
    randomToken: false,
  };

  let tokenSpecified = false;

  for (const arg of args) {
    if (arg === "--mode=quick") {
      config.mode = "quick";
    } else if (arg === "--mode=full") {
      config.mode = "full";
    } else if (arg === "--all-tokens") {
      config.tokens = ["STX", "sBTC", "USDCx"];
      tokenSpecified = true;
    } else if (arg === "--random-token") {
      // Pick one random token - applied after parsing
      config.randomToken = true;
    } else if (arg.startsWith("--token=")) {
      const rawToken = arg.split("=")[1].toUpperCase();
      const token = (rawToken === "SBTC" ? "sBTC" : rawToken === "USDCX" ? "USDCx" : rawToken) as TokenType;
      if (["STX", "sBTC", "USDCx"].includes(token)) {
        if (!tokenSpecified) {
          config.tokens = [];
          tokenSpecified = true;
        }
        if (!config.tokens.includes(token)) {
          config.tokens.push(token);
        }
      }
    } else if (arg.startsWith("--sample=")) {
      config.sampleSize = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--random-lifecycle=")) {
      config.randomLifecycleCount = parseInt(arg.split("=")[1], 10);
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
    }
  }

  // Apply random token selection if requested
  if (config.randomToken && !tokenSpecified) {
    config.tokens = [pickRandom(TEST_TOKENS)];
  }

  return config;
}

// =============================================================================
// X402 V2 Payment Flow
// =============================================================================

// Nonce conflict delay used by the test runner to wait for a "stuck" tx
// to clear from the mempool before retrying. Matches the default in
// RetryConfig.nonceConflictDelayMs for consistency across test files.
const NONCE_CONFLICT_DELAY_MS = 30000;

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
    // For free endpoints, skip the payment flow
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

    // Parse V2 payment requirements
    let paymentReq: PaymentRequiredV2 = await initialRes.json();

    if (paymentReq.x402Version !== 2 || !paymentReq.accepts?.length) {
      return { passed: false, error: "Invalid V2 payment requirements" };
    }

    let requirements = paymentReq.accepts[0];
    const reqTokenType = requirements.extra?.tokenType as TokenType;
    if (reqTokenType && reqTokenType !== tokenType) {
      return { passed: false, error: `Token mismatch: expected ${tokenType}, got ${reqTokenType}` };
    }

    // Step 2-3: Sign and submit payment with retry logic
    let retryRes: Response | null = null;
    let lastError = "";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Sign payment (fresh on each attempt for nonce conflict recovery)
      if (attempt === 0) {
        logger.debug("2. Signing payment...");
      } else {
        logger.debug(`2. Re-signing payment (attempt ${attempt + 1}/${maxRetries + 1})...`);
      }

      // Build V1-compatible request for the client
      const v1Request = {
        maxAmountRequired: requirements.amount,
        resource: paymentReq.resource.url,
        payTo: requirements.payTo,
        network: X402_NETWORK as "mainnet" | "testnet",
        nonce: (requirements.extra?.nonce as string) || crypto.randomUUID(),
        expiresAt: new Date(Date.now() + requirements.maxTimeoutSeconds * 1000).toISOString(),
        tokenType: reqTokenType || tokenType,
        ...(requirements.extra?.tokenContract && { tokenContract: requirements.extra.tokenContract }),
      };

      const signResult = await x402Client.signPayment(v1Request);

      // Build V2 payload and submit
      const paymentPayload = buildPaymentPayloadV2(signResult.signedTransaction, requirements);
      const encodedPayload = btoa(JSON.stringify(paymentPayload));

      if (attempt === 0) {
        logger.debug("3. Submitting with payment...");
      } else {
        logger.debug(`3. Retry attempt ${attempt}/${maxRetries}...`);
      }

      retryRes = await fetch(fullUrl, {
        method: config.method,
        headers: {
          ...(config.body ? { "Content-Type": "application/json" } : {}),
          ...config.headers,
          [X402_HEADERS.PAYMENT_SIGNATURE]: encodedPayload,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      const allowedStatuses = [200, ...(config.allowedStatuses || [])];
      if (allowedStatuses.includes(retryRes.status)) {
        break;
      }

      const errText = await retryRes.text();
      const retryAfterHeader = retryRes.headers.get("Retry-After");

      let errorCode: string | undefined;
      let errorMessage: string | undefined;
      let bodyRetryAfter: number | undefined;
      try {
        const parsed = JSON.parse(errText);
        errorCode = parsed.code;
        errorMessage = parsed.error || parsed.details?.errorReason || parsed.details?.exceptionMessage;
        bodyRetryAfter = parsed.retryAfter;
      } catch { /* not JSON */ }

      const fullErrorText = `${errorCode || ""} ${errorMessage || ""} ${errText}`;

      // Check for nonce conflict - needs fresh 402 and re-sign
      if (isNonceConflict(fullErrorText) && attempt < maxRetries) {
        logger.debug(`Nonce conflict detected, waiting ${NONCE_CONFLICT_DELAY_MS}ms for mempool to clear...`);
        await sleep(NONCE_CONFLICT_DELAY_MS);

        // Re-fetch 402 to get fresh nonce
        logger.debug("Re-fetching payment requirements with fresh nonce...");
        const freshRes = await fetch(fullUrl, {
          method: config.method,
          headers: {
            ...(config.body ? { "Content-Type": "application/json" } : {}),
            ...config.headers,
          },
          body: config.body ? JSON.stringify(config.body) : undefined,
        });

        if (freshRes.status === 402) {
          paymentReq = await freshRes.json();
          if (paymentReq.x402Version === 2 && paymentReq.accepts?.length) {
            requirements = paymentReq.accepts[0];
            const noncePreview = (requirements.extra?.nonce as string)?.slice(0, 8) ?? "unknown";
            logger.debug(`Got fresh nonce: ${noncePreview}...`);
            continue;
          }
        }
        // Fresh fetch didn't return valid 402 - can't retry
        logger.debug(`Fresh payment requirements fetch failed with status ${freshRes.status}, not retrying`);
        break;
      }

      // Check for other retryable errors
      if (isRetryableError(retryRes.status, errorCode, errorMessage || errText) && attempt < maxRetries) {
        const retryAfterSecs = retryAfterHeader ? parseInt(retryAfterHeader, 10) : (bodyRetryAfter || 0);
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        const delayMs = retryAfterSecs > 0 ? retryAfterSecs * 1000 : backoffMs;

        logger.debug(`Retryable error (${retryRes.status}), waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
        continue;
      }

      const parsedError = formatErrorResponse(retryRes.status, errText, retryAfterHeader);
      lastError = `(${retryRes.status}) ${parsedError.message}`;

      if (parsedError.details) {
        logger.debug("Error details:", parsedError.details);
      }
      break;
    }

    const allowedStatuses = [200, ...(config.allowedStatuses || [])];
    if (!retryRes || !allowedStatuses.includes(retryRes.status)) {
      return { passed: false, error: lastError || "Request failed" };
    }

    // Step 4: Validate response
    const contentType = retryRes.headers.get("content-type") || "";
    const expectedContentType = config.expectedContentType || "application/json";

    if (!contentType.includes("application/json")) {
      if (contentType.includes(expectedContentType.split("/")[0])) {
        return { passed: true };
      }
      return { passed: false, error: `Wrong content-type: expected ${expectedContentType}, got ${contentType}` };
    }

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

interface RunStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  byToken: Record<TokenType, { passed: number; failed: number }>;
  failedTests: Array<{ name: string; token: TokenType; error: string }>;
  lifecycleResults: Array<{ category: string; passed: number; total: number; success: boolean }>;
}

async function runStatelessTests(
  endpoints: TestConfig[],
  runConfig: RunConfig,
  x402Client: X402PaymentClient,
  stats: RunStats
): Promise<void> {
  let consecutiveFailures = 0;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];

    if (consecutiveFailures >= runConfig.maxConsecutiveFailures) {
      console.log(`\n${COLORS.red}${COLORS.bright}BAIL OUT: ${consecutiveFailures} consecutive failures${COLORS.reset}`);
      stats.skipped = (endpoints.length - i) * runConfig.tokens.length;
      break;
    }

    const progress = `[${i + 1}/${endpoints.length}]`;
    console.log(`${COLORS.bright}${progress}${COLORS.reset} ${COLORS.cyan}${endpoint.name}${COLORS.reset}`);

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

    console.log(`    ${tokenResults.join("  ")}`);

    if (runConfig.delayMs > 0 && i < endpoints.length - 1) {
      await sleep(runConfig.delayMs);
    }

    if (allPassed) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }

    await sleep(100);
  }
}

async function runLifecycleTests(
  categories: string[],
  verbose: boolean,
  stats: RunStats
): Promise<void> {
  for (const category of categories) {
    const runner = LIFECYCLE_RUNNERS[category];
    if (!runner) {
      console.log(`${COLORS.yellow}  No lifecycle test for ${category}${COLORS.reset}`);
      continue;
    }

    try {
      const result = await runner(verbose);
      stats.lifecycleResults.push({
        category,
        passed: result.passed,
        total: result.total,
        success: result.success,
      });
      stats.total += result.total;
      stats.passed += result.passed;
      stats.failed += result.total - result.passed;
    } catch (error) {
      console.log(`${COLORS.red}  Lifecycle test ${category} crashed: ${error}${COLORS.reset}`);
      stats.lifecycleResults.push({ category, passed: 0, total: 1, success: false });
      stats.failed++;
      stats.total++;
    }
  }
}

async function runTests(runConfig: RunConfig): Promise<RunStats> {
  if (!X402_CLIENT_PK) {
    throw new Error("Set X402_CLIENT_PK env var with mnemonic");
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    throw new Error(`Invalid X402_NETWORK: "${X402_NETWORK}". Must be "mainnet" or "testnet".`);
  }
  const network: NetworkType = X402_NETWORK;

  const { address, key } = await deriveChildAccount(network, X402_CLIENT_PK, 0);

  const x402Client = new X402PaymentClient({
    network,
    privateKey: key,
  });

  // Initialize stats
  const stats: RunStats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    byToken: {} as Record<TokenType, { passed: number; failed: number }>,
    failedTests: [],
    lifecycleResults: [],
  };

  for (const token of runConfig.tokens) {
    stats.byToken[token] = { passed: 0, failed: 0 };
  }

  // Determine what to run
  let endpointsToTest: TestConfig[] = [];
  let lifecycleCategories: string[] = [];

  if (runConfig.category) {
    // Specific category requested
    if (LIFECYCLE_RUNNERS[runConfig.category]) {
      // Run lifecycle test for this category (info, registry, links, agent)
      lifecycleCategories = [runConfig.category];
    } else if (ENDPOINT_CATEGORIES[runConfig.category]) {
      // Run individual tests for this stateless category
      endpointsToTest = ENDPOINT_CATEGORIES[runConfig.category];
    } else {
      console.log(`${COLORS.yellow}Unknown category: ${runConfig.category}${COLORS.reset}`);
      console.log(`Available: ${Object.keys(LIFECYCLE_RUNNERS).join(", ")}, ${Object.keys(ENDPOINT_CATEGORIES).join(", ")}`);
    }
  } else if (runConfig.mode === "quick") {
    // Quick mode: stateless endpoints only
    endpointsToTest = [...STATELESS_ENDPOINTS];
  } else {
    // Full mode: stateless + all lifecycle tests
    endpointsToTest = [...STATELESS_ENDPOINTS];
    lifecycleCategories = [...STATEFUL_CATEGORIES];
  }

  // Apply filter if specified
  if (runConfig.filter && endpointsToTest.length > 0) {
    endpointsToTest = endpointsToTest.filter((e) =>
      e.name.toLowerCase().includes(runConfig.filter!)
    );
  }

  // Apply random sampling if specified
  if (runConfig.sampleSize !== null && endpointsToTest.length > 0) {
    endpointsToTest = sampleArray(endpointsToTest, runConfig.sampleSize);
  }

  // Apply random lifecycle sampling if specified
  if (runConfig.randomLifecycleCount !== null && lifecycleCategories.length > 0) {
    lifecycleCategories = sampleArray(lifecycleCategories, runConfig.randomLifecycleCount);
  }

  // Print header
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  X402 V2 ENDPOINT TEST RUNNER${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`  Wallet:     ${address}`);
  console.log(`  Network:    ${network}`);
  console.log(`  Server:     ${X402_WORKER_URL}`);
  console.log(`  Mode:       ${runConfig.mode}`);
  if (runConfig.category) {
    console.log(`  Category:   ${runConfig.category}`);
  }
  console.log(`  Tokens:     ${runConfig.tokens.join(", ")}${runConfig.randomToken ? " (random)" : ""}`);
  if (endpointsToTest.length > 0) {
    const sampleNote = runConfig.sampleSize !== null ? ` (sampled from ${STATELESS_ENDPOINTS.length})` : "";
    console.log(`  Endpoints:  ${endpointsToTest.length} stateless${sampleNote}`);
    if (runConfig.sampleSize !== null) {
      console.log(`              [${endpointsToTest.map((e) => e.name).join(", ")}]`);
    }
  }
  if (lifecycleCategories.length > 0) {
    const lifecycleNote = runConfig.randomLifecycleCount !== null ? ` (sampled from ${STATEFUL_CATEGORIES.length})` : "";
    console.log(`  Lifecycle:  ${lifecycleCategories.join(", ")}${lifecycleNote}`);
  }
  console.log(`  Delay:      ${runConfig.delayMs}ms between tests`);
  console.log(`  Retries:    ${runConfig.maxRetries} for rate-limited requests`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}\n`);

  // Run stateless tests
  if (endpointsToTest.length > 0) {
    console.log(`${COLORS.bright}Running ${endpointsToTest.length} stateless endpoint tests...${COLORS.reset}\n`);
    await runStatelessTests(endpointsToTest, runConfig, x402Client, stats);
  }

  // Run lifecycle tests
  if (lifecycleCategories.length > 0) {
    console.log(`\n${COLORS.bright}Running ${lifecycleCategories.length} lifecycle test(s)...${COLORS.reset}`);
    await runLifecycleTests(lifecycleCategories, runConfig.verbose, stats);
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

    // Per-token breakdown (only if we ran stateless tests)
    if (Object.values(stats.byToken).some(t => t.passed + t.failed > 0)) {
      console.log(`\n  By Token:`);
      for (const [token, tokenStats] of Object.entries(stats.byToken)) {
        const tokenTotal = tokenStats.passed + tokenStats.failed;
        if (tokenTotal > 0) {
          const tokenRate = ((tokenStats.passed / tokenTotal) * 100).toFixed(0);
          const tokenColor = tokenStats.failed === 0 ? COLORS.green : COLORS.yellow;
          console.log(`    ${tokenColor}${token}: ${tokenStats.passed}/${tokenTotal} (${tokenRate}%)${COLORS.reset}`);
        }
      }
    }

    // Lifecycle test results
    if (stats.lifecycleResults.length > 0) {
      console.log(`\n  Lifecycle Tests:`);
      for (const lr of stats.lifecycleResults) {
        const icon = lr.success ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
        console.log(`    ${icon} ${lr.category}: ${lr.passed}/${lr.total}`);
      }
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

    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${COLORS.red}${COLORS.bright}FATAL ERROR:${COLORS.reset}`, error);
    process.exit(1);
  }
}

main();
