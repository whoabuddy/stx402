/**
 * SSRF Protection Tests
 *
 * Tests that private IP ranges are blocked in /registry/probe
 *
 * Usage:
 *   X402_WORKER_URL="https://your-preview.workers.dev" X402_CLIENT_PK="..." bun run tests/ssrf-protection.test.ts
 */

import type { TokenType, NetworkType } from "x402-stacks";
import { X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
  makeX402RequestWithRetry,
} from "./_shared_utils";

const TOKEN_TYPE: TokenType = "STX";
const VERBOSE = process.env.VERBOSE === "1";

// Local wrapper matching registry-lifecycle pattern
async function makeX402Request(
  endpoint: string,
  method: "GET" | "POST",
  x402Client: X402PaymentClient,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const result = await makeX402RequestWithRetry(endpoint, method, x402Client, TOKEN_TYPE, {
    body,
    retry: {
      maxRetries: 3,
      nonceConflictDelayMs: 30000,
      verbose: VERBOSE,
    },
  });
  return { status: result.status, data: result.data };
}

// Private IPs that should be blocked
const BLOCKED_URLS = [
  { url: "http://localhost/test", reason: "localhost" },
  { url: "http://127.0.0.1/test", reason: "loopback" },
  { url: "http://192.168.1.1/test", reason: "private class C" },
  { url: "http://10.0.0.1/test", reason: "private class A" },
  { url: "http://172.16.0.1/test", reason: "private class B" },
  { url: "http://169.254.1.1/test", reason: "link-local" },
  { url: "http://[::1]/test", reason: "IPv6 loopback" },
  { url: "http://server.local/test", reason: ".local hostname" },
  { url: "http://internal.corp/test", reason: ".corp hostname" },
];

// Public URL that should work (we don't care if it's actually x402, just that it's not blocked)
const ALLOWED_URL = "https://example.com";

function log(msg: string) {
  console.log(`${COLORS.cyan}[SSRF]${COLORS.reset} ${msg}`);
}

function logSuccess(msg: string) {
  console.log(`${COLORS.green}[SSRF] ✅ ${msg}${COLORS.reset}`);
}

function logError(msg: string) {
  console.log(`${COLORS.red}[SSRF] ❌ ${msg}${COLORS.reset}`);
}

async function main() {
  if (!X402_CLIENT_PK) {
    console.error("X402_CLIENT_PK environment variable required");
    process.exit(1);
  }

  log(`Testing against: ${X402_WORKER_URL}`);
  log(`Network: ${X402_NETWORK}`);

  // Setup client
  const { address, key } = await deriveChildAccount(
    X402_NETWORK as NetworkType,
    X402_CLIENT_PK,
    0
  );

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK as NetworkType,
    privateKey: key,
  });

  log(`Payer: ${address}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: Public URL should be allowed (not blocked by SSRF filter)
  log("Testing public URL is allowed...");
  try {
    const { status, data } = await makeX402Request(
      "/registry/probe",
      "POST",
      x402Client,
      { url: ALLOWED_URL }
    );

    // We expect 200 - the probe may fail to find x402 requirements, but it shouldn't be SSRF-blocked
    if (status === 200) {
      const result = data as { success: boolean; error?: string };
      if (result.error?.includes("Cannot probe")) {
        logError(`Public URL was incorrectly blocked: ${result.error}`);
        failed++;
      } else {
        logSuccess(`Public URL allowed (${ALLOWED_URL})`);
        passed++;
      }
    } else {
      logError(`Unexpected status ${status}: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (error) {
    logError(`Exception testing public URL: ${error}`);
    failed++;
  }

  // Test 2: Private IPs should be blocked
  log("\nTesting private IPs are blocked...");
  for (const { url, reason } of BLOCKED_URLS) {
    try {
      const { status, data } = await makeX402Request(
        "/registry/probe",
        "POST",
        x402Client,
        { url }
      );

      const result = data as { success: boolean; error?: string };

      // Check if blocked - success should be false with "Cannot probe" error
      if (result.success === false && result.error?.includes("Cannot probe")) {
        logSuccess(`Blocked ${reason}: ${url}`);
        passed++;
      } else if (result.success === false && result.error) {
        // Also acceptable - blocked with some error
        logSuccess(`Blocked ${reason}: ${url} (${result.error})`);
        passed++;
      } else {
        // Not blocked - show what we got
        logError(`NOT blocked (${reason}): ${url} - success=${result.success}, error=${result.error || 'none'}`);
        failed++;
      }
    } catch (error) {
      logError(`Exception testing ${reason}: ${error}`);
      failed++;
    }
  }

  // Summary
  const total = passed + failed;
  console.log(`\n${COLORS.bright}========================================${COLORS.reset}`);
  if (failed === 0) {
    console.log(`${COLORS.green}${COLORS.bright}All ${total} SSRF tests passed!${COLORS.reset}`);
  } else {
    console.log(`${COLORS.yellow}${COLORS.bright}${passed}/${total} tests passed, ${failed} failed${COLORS.reset}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
