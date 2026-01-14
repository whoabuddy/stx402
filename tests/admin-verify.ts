/**
 * Registry Admin Verification Script
 *
 * List pending endpoints and verify/reject them as admin.
 * Admin endpoints are free (no payment required) - only admin address check.
 *
 * Usage:
 *   bun run tests/admin-verify.ts list
 *   bun run tests/admin-verify.ts verify <url> [url...]
 *   bun run tests/admin-verify.ts reject <url> [url...]
 *
 * Environment:
 *   X402_PK         - Server mnemonic (to derive admin address)
 *   X402_NETWORK    - "mainnet" or "testnet" (default: mainnet)
 *   X402_WORKER_URL - API URL (default: https://stx402.com)
 *   VERBOSE=1       - Enable verbose logging
 */

import type { NetworkType } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { COLORS } from "./_shared_utils";

// =============================================================================
// Configuration
// =============================================================================

const VERBOSE = process.env.VERBOSE === "1";
const X402_PK = process.env.X402_PK;
const X402_NETWORK = (process.env.X402_NETWORK || "mainnet") as NetworkType;
const X402_WORKER_URL = process.env.X402_WORKER_URL || "https://stx402.com";

// =============================================================================
// Helpers
// =============================================================================

function log(message: string, ...args: unknown[]) {
  if (VERBOSE) {
    console.log(`  ${COLORS.gray}${message}${COLORS.reset}`, ...args);
  }
}

function logSuccess(message: string) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logError(message: string) {
  console.log(`${COLORS.red}✗${COLORS.reset} ${message}`);
}

function printUsage() {
  console.log(`
${COLORS.bright}Registry Admin Verification${COLORS.reset}

${COLORS.cyan}Usage:${COLORS.reset}
  bun run tests/admin-verify.ts list                    List all pending endpoints
  bun run tests/admin-verify.ts verify <url> [url...]   Verify one or more endpoints
  bun run tests/admin-verify.ts reject <url> [url...]   Reject one or more endpoints

${COLORS.cyan}Environment:${COLORS.reset}
  X402_PK         Server mnemonic (required, to derive admin address)
  X402_NETWORK    "mainnet" or "testnet" (default: mainnet)
  X402_WORKER_URL API URL (default: https://stx402.com)
  VERBOSE=1       Enable verbose logging

${COLORS.cyan}Examples:${COLORS.reset}
  X402_PK="..." bun run tests/admin-verify.ts list
  X402_PK="..." bun run tests/admin-verify.ts verify https://example.com/api/endpoint
  X402_PK="..." bun run tests/admin-verify.ts verify https://a.com/api https://b.com/api
  X402_PK="..." bun run tests/admin-verify.ts reject https://spam.com/api
`);
}

// =============================================================================
// API Requests (no payment required - admin endpoints are free)
// =============================================================================

async function makeRequest(
  endpoint: string,
  body: unknown
): Promise<{ status: number; data: unknown }> {
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;

  log(`POST ${endpoint}...`);

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data: unknown;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

// =============================================================================
// Commands
// =============================================================================

interface PendingEntry {
  id: string;
  url: string;
  name: string;
  description?: string;
  owner: string;
  category?: string;
  registeredAt: string;
  probeData?: {
    isX402Endpoint: boolean;
    paymentAddress?: string;
    responseTimeMs?: number;
  };
}

async function listPending(adminAddress: string): Promise<boolean> {
  console.log(`\n${COLORS.bright}Listing Pending Endpoints${COLORS.reset}\n`);

  const { status, data } = await makeRequest("/admin/registry/pending", {
    adminAddress,
  });

  if (status === 403) {
    logError(`Not authorized - adminAddress doesn't match server address`);
    console.log(`  Provided: ${adminAddress}`);
    return false;
  }

  if (status !== 200) {
    logError(`Request failed: ${status}`);
    console.log(JSON.stringify(data, null, 2));
    return false;
  }

  const result = data as { entries: PendingEntry[]; count: number };

  if (result.count === 0) {
    console.log(`${COLORS.gray}No pending endpoints${COLORS.reset}`);
    return true;
  }

  console.log(`${COLORS.cyan}Found ${result.count} pending endpoint(s):${COLORS.reset}\n`);

  for (const entry of result.entries) {
    console.log(`${COLORS.bright}${entry.name}${COLORS.reset}`);
    console.log(`  URL:      ${entry.url}`);
    console.log(`  Owner:    ${entry.owner}`);
    console.log(`  Category: ${entry.category || "none"}`);
    console.log(`  Registered: ${entry.registeredAt}`);
    if (entry.probeData) {
      console.log(`  X402:     ${entry.probeData.isX402Endpoint ? "Yes" : "No"}`);
      if (entry.probeData.paymentAddress) {
        console.log(`  Pay To:   ${entry.probeData.paymentAddress}`);
      }
    }
    console.log();
  }

  return true;
}

async function verifyOrReject(
  adminAddress: string,
  url: string,
  action: "verify" | "reject"
): Promise<boolean> {
  const actionLabel = action === "verify" ? "Verifying" : "Rejecting";
  console.log(`\n${COLORS.bright}${actionLabel} Endpoint${COLORS.reset}\n`);
  console.log(`  URL: ${url}`);
  console.log(`  Action: ${action}\n`);

  const { status, data } = await makeRequest("/admin/registry/verify", {
    url,
    action,
    adminAddress,
  });

  if (status === 403) {
    logError(`Not authorized - adminAddress doesn't match server address`);
    return false;
  }

  if (status === 404) {
    logError(`Endpoint not found in registry`);
    return false;
  }

  if (status !== 200) {
    logError(`Request failed: ${status}`);
    console.log(JSON.stringify(data, null, 2));
    return false;
  }

  const result = data as {
    success: boolean;
    action: string;
    entry: { id: string; url: string; name: string; status: string };
  };

  if (!result.success) {
    logError(`Action failed`);
    console.log(JSON.stringify(data, null, 2));
    return false;
  }

  logSuccess(`${result.entry.name} - status: ${result.entry.status}`);
  return true;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  if (!X402_PK) {
    logError("X402_PK environment variable is required");
    printUsage();
    process.exit(1);
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    logError(`Invalid X402_NETWORK: ${X402_NETWORK}`);
    process.exit(1);
  }

  // Derive admin address from mnemonic
  const { address: adminAddress } = await deriveChildAccount(
    X402_NETWORK,
    X402_PK,
    0
  );

  console.log(`${COLORS.gray}Admin: ${adminAddress}${COLORS.reset}`);
  console.log(`${COLORS.gray}Network: ${X402_NETWORK}${COLORS.reset}`);
  console.log(`${COLORS.gray}Server: ${X402_WORKER_URL}${COLORS.reset}`);

  let success = false;

  switch (command) {
    case "list":
      success = await listPending(adminAddress);
      break;

    case "verify":
    case "reject": {
      const urls = args.slice(1);
      if (urls.length === 0) {
        logError(`At least one URL is required for ${command} command`);
        printUsage();
        process.exit(1);
      }

      let successCount = 0;
      for (const url of urls) {
        const result = await verifyOrReject(adminAddress, url, command);
        if (result) successCount++;
      }

      const actionLabel = command === "verify" ? "verified" : "rejected";
      console.log(`\n${COLORS.bright}Summary:${COLORS.reset} ${successCount}/${urls.length} ${actionLabel} successfully`);
      success = successCount === urls.length;
      break;
    }

    default:
      logError(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  if (VERBOSE) {
    console.error(error);
  }
  process.exit(1);
});
