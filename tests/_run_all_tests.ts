/**
 * X402 Endpoint Test Runner
 *
 * Runs E2E payment tests against all registered endpoints.
 *
 * Usage:
 *   bun run tests/_run_all_tests.ts                    # All endpoints, STX only
 *   bun run tests/_run_all_tests.ts --all-tokens       # All endpoints, all tokens
 *   bun run tests/_run_all_tests.ts --token=sBTC       # All endpoints, specific token
 *   bun run tests/_run_all_tests.ts --category=stacks  # Single category
 *   bun run tests/_run_all_tests.ts --filter=sha256    # Filter by name
 *
 * Environment:
 *   X402_CLIENT_PK  - Testnet mnemonic for payments (required)
 *   X402_NETWORK    - Network (default: testnet)
 *   VERBOSE=1       - Enable verbose logging
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
// Configuration
// =============================================================================

interface RunConfig {
  tokens: TokenType[];
  category: string | null;
  filter: string | null;
  maxConsecutiveFailures: number;
  verbose: boolean;
}

function parseArgs(): RunConfig {
  const args = process.argv.slice(2);
  const config: RunConfig = {
    tokens: ["STX"], // Default to single token
    category: null,
    filter: null,
    maxConsecutiveFailures: 5,
    verbose: process.env.VERBOSE === "1",
  };

  for (const arg of args) {
    if (arg === "--all-tokens") {
      config.tokens = ["STX", "sBTC", "USDCx"];
    } else if (arg.startsWith("--token=")) {
      const token = arg.split("=")[1].toUpperCase();
      if (["STX", "SBTC", "USDCX"].includes(token)) {
        config.tokens = [token === "SBTC" ? "sBTC" : token === "USDCX" ? "USDCx" : token] as TokenType[];
      }
    } else if (arg.startsWith("--category=")) {
      config.category = arg.split("=")[1].toLowerCase();
    } else if (arg.startsWith("--filter=")) {
      config.filter = arg.split("=")[1].toLowerCase();
    } else if (arg.startsWith("--max-failures=")) {
      config.maxConsecutiveFailures = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--verbose" || arg === "-v") {
      config.verbose = true;
    }
  }

  return config;
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
  verbose: boolean
): Promise<{ passed: boolean; error?: string }> {
  const logger = createTestLogger(config.name, verbose);
  const endpoint = config.endpoint.includes("?")
    ? `${config.endpoint}&tokenType=${tokenType}`
    : `${config.endpoint}?tokenType=${tokenType}`;
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;

  try {
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

    // Step 3: Retry with X-PAYMENT header
    logger.debug("3. Retry with payment...");

    const retryRes = await fetch(fullUrl, {
      method: config.method,
      headers: {
        ...(config.body ? { "Content-Type": "application/json" } : {}),
        ...config.headers,
        "X-PAYMENT": signResult.signedTransaction,
        "X-PAYMENT-TOKEN-TYPE": tokenType,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (retryRes.status !== 200) {
      const errText = await retryRes.text();
      return { passed: false, error: `Retry failed (${retryRes.status}): ${errText.slice(0, 100)}` };
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
    throw new Error("Set X402_CLIENT_PK env var with testnet mnemonic");
  }

  // Initialize wallet
  const { address, key } = await deriveChildAccount(
    X402_NETWORK as NetworkType,
    X402_CLIENT_PK,
    0
  );

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK as NetworkType,
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
  console.log(`  Server:     ${X402_WORKER_URL}`);
  console.log(`  Endpoints:  ${endpoints.length}`);
  console.log(`  Tokens:     ${runConfig.tokens.join(", ")}`);
  console.log(`  Total runs: ${endpoints.length * runConfig.tokens.length}`);
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
        runConfig.verbose
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
