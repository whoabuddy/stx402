/**
 * Links (URL Shortener) Lifecycle Tests
 *
 * Tests the full lifecycle of Links endpoints:
 *
 * 1. Create - create a short link
 * 2. List - list all links (should have 1)
 * 3. Expand - access the short link (free, records click)
 * 4. Stats - get click statistics
 * 5. Create with custom slug - test custom slug
 * 6. Delete - remove the link
 * 7. List - verify deletion
 *
 * Usage:
 *   bun run tests/links-lifecycle.test.ts
 *
 * Environment:
 *   X402_CLIENT_PK  - Mnemonic for payments (required)
 *   X402_WORKER_URL - API URL (default: http://localhost:8787)
 *   VERBOSE=1       - Enable verbose logging
 */

import type { TokenType } from "x402-stacks";
import { X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "./_shared_wallet";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
  makeX402RequestWithRetry,
  sleep,
} from "./_shared_utils";

// =============================================================================
// Configuration
// =============================================================================

const VERBOSE = process.env.VERBOSE === "1";
const TOKEN_TYPE: TokenType = "STX";

// Test slugs - unique per run
const TEST_SLUG_CUSTOM = `test-slug-${Date.now()}`;

// =============================================================================
// Test Helpers
// =============================================================================

function log(message: string, ...args: unknown[]) {
  if (VERBOSE) {
    console.log(`  ${COLORS.gray}${message}${COLORS.reset}`, ...args);
  }
}

function logStep(step: number, total: number, name: string) {
  console.log(`\n${COLORS.bright}[${step}/${total}]${COLORS.reset} ${COLORS.cyan}${name}${COLORS.reset}`);
}

function logSuccess(message: string) {
  console.log(`  ${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logError(message: string) {
  console.log(`  ${COLORS.red}✗${COLORS.reset} ${message}`);
}

// =============================================================================
// X402 Payment Flow (with retry for nonce conflicts)
// =============================================================================

async function makeX402Request(
  endpoint: string,
  method: "GET" | "POST",
  x402Client: X402PaymentClient,
  body?: unknown
): Promise<{ status: number; data: unknown; headers: Headers }> {
  log(`Requesting ${method} ${endpoint}...`);

  const result = await makeX402RequestWithRetry(endpoint, method, x402Client, TOKEN_TYPE, {
    body,
    retry: {
      maxRetries: 3,
      nonceConflictDelayMs: 30000, // 30s for nonce conflicts
      verbose: VERBOSE,
    },
  });

  if (result.wasNonceConflict && result.retryCount && result.retryCount > 0) {
    log(`Recovered from nonce conflict after ${result.retryCount} retries`);
  }

  return { status: result.status, data: result.data, headers: result.headers };
}

// Free request (no payment needed - for expand endpoint)
async function makeFreeRequest(
  endpoint: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;

  log(`Requesting ${method} ${endpoint} (free)...`);

  const res = await fetch(fullUrl, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual", // Don't follow redirects automatically
  });

  let data: unknown;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

// =============================================================================
// Test Context
// =============================================================================

interface TestContext {
  x402Client: X402PaymentClient;
  ownerAddress: string;
  network: "mainnet" | "testnet";
  createdSlug: string; // Track the auto-generated slug
}

// =============================================================================
// Link Tests
// =============================================================================

async function testLinksCreate(ctx: TestContext): Promise<boolean> {
  logStep(1, 7, "Links: Create");

  try {
    const { status, data } = await makeX402Request(
      "/links/create",
      "POST",
      ctx.x402Client,
      { url: "https://example.com/test-page", title: "Test Link" }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { slug: string; shortUrl: string; url: string; title: string };
    if (!result.slug) {
      logError(`No slug returned`);
      return false;
    }
    if (!result.shortUrl.includes(result.slug)) {
      logError(`Short URL doesn't contain slug`);
      return false;
    }
    if (result.url !== "https://example.com/test-page") {
      logError(`URL mismatch: ${result.url}`);
      return false;
    }

    // Store the slug for later tests
    ctx.createdSlug = result.slug;

    logSuccess(`Created link: ${result.shortUrl} → ${result.url}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testLinksList(ctx: TestContext): Promise<boolean> {
  logStep(2, 7, "Links: List");

  try {
    const { status, data } = await makeX402Request(
      "/links/list",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { links: Array<{ slug: string; url: string; clicks: number }>; count: number };
    if (result.count < 1) {
      logError(`Expected at least 1 link, got ${result.count}`);
      return false;
    }

    const createdLink = result.links.find(l => l.slug === ctx.createdSlug);
    if (!createdLink) {
      logError(`Created link not found in list`);
      return false;
    }

    logSuccess(`Listed ${result.count} links (found our test link: ${ctx.createdSlug})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testLinksExpand(ctx: TestContext): Promise<boolean> {
  logStep(3, 7, "Links: Expand (free, records click)");

  try {
    // Expand is free - no payment required
    const { status, data, headers } = await makeFreeRequest(
      `/links/expand/${ctx.createdSlug}`,
      "GET"
    );

    // Should get a redirect (302) or JSON with url
    if (status === 302) {
      const location = headers.get("Location");
      if (!location || !location.includes("example.com")) {
        logError(`Expected redirect to example.com, got: ${location}`);
        return false;
      }
      logSuccess(`Got redirect to: ${location}`);
      return true;
    } else if (status === 200) {
      const result = data as { url: string; slug: string };
      if (!result.url.includes("example.com")) {
        logError(`Expected URL with example.com, got: ${result.url}`);
        return false;
      }
      logSuccess(`Expanded: ${ctx.createdSlug} → ${result.url}`);
      return true;
    } else {
      logError(`Expected 200 or 302, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testLinksStats(ctx: TestContext): Promise<boolean> {
  logStep(4, 7, "Links: Stats");

  try {
    const { status, data } = await makeX402Request(
      "/links/stats",
      "POST",
      ctx.x402Client,
      { slug: ctx.createdSlug }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { slug: string; clicks: number; url: string; createdAt: string };
    if (result.slug !== ctx.createdSlug) {
      logError(`Slug mismatch: ${result.slug}`);
      return false;
    }
    if (result.clicks < 1) {
      logError(`Expected at least 1 click, got ${result.clicks}`);
      return false;
    }

    logSuccess(`Stats for ${result.slug}: ${result.clicks} clicks`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testLinksCreateCustomSlug(ctx: TestContext): Promise<boolean> {
  logStep(5, 7, "Links: Create with custom slug");

  try {
    const { status, data } = await makeX402Request(
      "/links/create",
      "POST",
      ctx.x402Client,
      { url: "https://github.com/stx402", slug: TEST_SLUG_CUSTOM, title: "Custom Slug Test" }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { slug: string; shortUrl: string; url: string };
    if (result.slug !== TEST_SLUG_CUSTOM) {
      logError(`Custom slug not used: ${result.slug}`);
      return false;
    }

    logSuccess(`Created with custom slug: ${result.slug} → ${result.url}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testLinksDelete(ctx: TestContext): Promise<boolean> {
  logStep(6, 7, "Links: Delete");

  try {
    // Delete both links we created
    const { status: status1, data: data1 } = await makeX402Request(
      "/links/delete",
      "POST",
      ctx.x402Client,
      { slug: ctx.createdSlug }
    );

    if (status1 !== 200) {
      logError(`Expected 200 for first delete, got ${status1}: ${JSON.stringify(data1)}`);
      return false;
    }

    const { status: status2, data: data2 } = await makeX402Request(
      "/links/delete",
      "POST",
      ctx.x402Client,
      { slug: TEST_SLUG_CUSTOM }
    );

    if (status2 !== 200) {
      logError(`Expected 200 for second delete, got ${status2}: ${JSON.stringify(data2)}`);
      return false;
    }

    logSuccess(`Deleted both test links: ${ctx.createdSlug}, ${TEST_SLUG_CUSTOM}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testLinksListAfterDelete(ctx: TestContext): Promise<boolean> {
  logStep(7, 7, "Links: List (verify deletion)");

  try {
    const { status, data } = await makeX402Request(
      "/links/list",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { links: Array<{ slug: string }>; count: number };

    // Check that our test links are gone
    const foundFirst = result.links.find(l => l.slug === ctx.createdSlug);
    const foundSecond = result.links.find(l => l.slug === TEST_SLUG_CUSTOM);

    if (foundFirst || foundSecond) {
      logError(`Deleted links still present in list`);
      return false;
    }

    logSuccess(`Verified deletion: test links no longer in list (${result.count} remaining)`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

// =============================================================================
// Exported Test Runner
// =============================================================================

export interface LifecycleTestResult {
  passed: number;
  total: number;
  success: boolean;
}

export async function runLinksLifecycle(verbose = false): Promise<LifecycleTestResult> {
  console.log(`${COLORS.bright}╔════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bright}║     Links Lifecycle Tests              ║${COLORS.reset}`);
  console.log(`${COLORS.bright}╚════════════════════════════════════════╝${COLORS.reset}`);
  console.log(`\n${COLORS.gray}Server: ${X402_WORKER_URL}${COLORS.reset}`);
  console.log(`${COLORS.gray}Network: ${X402_NETWORK}${COLORS.reset}`);
  console.log(`${COLORS.gray}Token: ${TOKEN_TYPE}${COLORS.reset}`);

  // Initialize X402 client
  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: X402_CLIENT_PK environment variable is required${COLORS.reset}`);
    process.exit(1);
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    console.error(`${COLORS.red}Error: Invalid X402_NETWORK${COLORS.reset}`);
    process.exit(1);
  }

  const { address, key } = await deriveChildAccount(X402_NETWORK, X402_CLIENT_PK, 0);

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK,
    privateKey: key,
  });

  console.log(`${COLORS.gray}Client: ${address}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network: X402_NETWORK,
    createdSlug: "",
  };

  // Run initial test - if it fails, bail out (no state to test)
  const totalTests = 7;
  let passed = 0;

  const createResult = await testLinksCreate(ctx);
  if (!createResult) {
    console.log(`\n${COLORS.yellow}Bailing out: initial create failed, skipping remaining tests${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`  0/${totalTests} tests passed (setup failed)`);
    console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);
    return { passed: 0, total: totalTests, success: false };
  }
  passed++;
  // Wait longer after create for KV eventual consistency
  // CF KV writes can take up to 60s to propagate globally
  await sleep(5000);

  // Run remaining tests
  const remainingTests = [
    testLinksList,
    testLinksExpand,
    testLinksStats,
    testLinksCreateCustomSlug,
    testLinksDelete,
    testLinksListAfterDelete,
  ];

  for (const test of remainingTests) {
    if (await test(ctx)) {
      passed++;
    }
    await sleep(300);
  }

  // Summary
  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  const pct = ((passed / totalTests) * 100).toFixed(1);
  console.log(`  ${passed}/${totalTests} tests passed (${pct}%)`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);

  return { passed, total: totalTests, success: passed === totalTests };
}

// =============================================================================
// Main (when run directly)
// =============================================================================

if (import.meta.main) {
  runLinksLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}
