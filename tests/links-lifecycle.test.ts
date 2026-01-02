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
import { deriveChildAccount } from "../src/utils/wallet";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
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
// X402 Payment Flow
// =============================================================================

interface PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

async function makeX402Request(
  endpoint: string,
  method: "GET" | "POST",
  x402Client: X402PaymentClient,
  body?: unknown
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;
  const tokenParam = endpoint.includes("?") ? `&tokenType=${TOKEN_TYPE}` : `?tokenType=${TOKEN_TYPE}`;

  log(`Requesting ${method} ${endpoint}...`);

  const initialRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  // If not 402, return as-is
  if (initialRes.status !== 402) {
    let data: unknown;
    const text = await initialRes.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: initialRes.status, data, headers: initialRes.headers };
  }

  // Get payment requirements
  const paymentText = await initialRes.text();
  const paymentReq: PaymentRequired = JSON.parse(paymentText);
  log(`Payment required: ${paymentReq.maxAmountRequired} ${paymentReq.tokenType}`);

  // Sign payment
  const signResult = await x402Client.signPayment(paymentReq);
  log("Payment signed");

  // Retry with payment
  const paidRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-PAYMENT": signResult.signedTransaction,
      "X-PAYMENT-TOKEN-TYPE": TOKEN_TYPE,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  const responseText = await paidRes.text();
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }
  return { status: paidRes.status, data, headers: paidRes.headers };
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
      "/api/links/create",
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
      "/api/links/list",
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
      `/api/links/expand/${ctx.createdSlug}`,
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
      "/api/links/stats",
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
      "/api/links/create",
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
      "/api/links/delete",
      "POST",
      ctx.x402Client,
      { slug: ctx.createdSlug }
    );

    if (status1 !== 200) {
      logError(`Expected 200 for first delete, got ${status1}: ${JSON.stringify(data1)}`);
      return false;
    }

    const { status: status2, data: data2 } = await makeX402Request(
      "/api/links/delete",
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
      "/api/links/list",
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
// Main Test Runner
// =============================================================================

async function runTests() {
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

  const { address, privateKey } = await deriveChildAccount(
    X402_NETWORK as "mainnet" | "testnet",
    X402_CLIENT_PK,
    0
  );

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK as "mainnet" | "testnet",
    privateKey: privateKey as string,
    senderAddress: address as string,
  });

  console.log(`${COLORS.gray}Client: ${address}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address as string,
    network: X402_NETWORK as "mainnet" | "testnet",
    createdSlug: "",
  };

  // Run all tests in sequence
  const tests = [
    testLinksCreate,
    testLinksList,
    testLinksExpand,
    testLinksStats,
    testLinksCreateCustomSlug,
    testLinksDelete,
    testLinksListAfterDelete,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test(ctx);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  // Summary
  console.log(`\n${COLORS.bright}═══════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}Summary:${COLORS.reset} ${passed}/${tests.length} passed`);

  if (failed > 0) {
    console.log(`${COLORS.red}${failed} test(s) failed${COLORS.reset}`);
    process.exit(1);
  } else {
    console.log(`${COLORS.green}All tests passed!${COLORS.reset}`);
  }
}

// Run
runTests().catch((error) => {
  console.error(`${COLORS.red}Fatal error: ${error}${COLORS.reset}`);
  process.exit(1);
});
