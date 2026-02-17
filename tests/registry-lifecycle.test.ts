/**
 * Registry Endpoint Lifecycle Tests
 *
 * Tests the full registry lifecycle:
 * 1. Probe - probe an external x402 endpoint
 * 2. Register - register a test endpoint
 * 3. List - list all endpoints (free, should include ours)
 * 4. Details - get full details of our endpoint
 * 5. Update - update our endpoint metadata
 * 6. My Endpoints - list endpoints we own (with signature)
 * 7. Transfer - transfer ownership to account[1] (challenge-response)
 * 8. Delete - delete our endpoint as new owner (challenge-response)
 *
 * Usage:
 *   bun run tests/registry-lifecycle.test.ts
 *
 * Environment:
 *   X402_CLIENT_PK  - Testnet mnemonic for payments (required)
 *   VERBOSE=1       - Enable verbose logging
 */

import type { TokenType, NetworkType } from "x402-stacks";
import { X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "./_shared_wallet";
import {
  Cl,
  cvToHex,
  hexToCV,
  signStructuredData,
} from "@stacks/transactions";
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

// Test endpoint URL - use our own stx402.com as the test subject
const TEST_ENDPOINT_URL = `https://stx402.com/api/test-registry-${Date.now()}`;
const TEST_ENDPOINT_NAME = "Registry Lifecycle Test";
const TEST_ENDPOINT_DESCRIPTION = "Temporary endpoint for testing registry lifecycle";

// =============================================================================
// SIP-018 Signature Helpers
// =============================================================================

function getDomain(network: "mainnet" | "testnet") {
  return Cl.tuple({
    name: Cl.stringAscii("stx402-registry"),
    version: Cl.stringAscii("1.0.0"),
    "chain-id": Cl.uint(network === "mainnet" ? 1 : 2147483648),
  });
}

function createListMyEndpointsMessage(owner: string, timestamp: number) {
  return Cl.tuple({
    action: Cl.stringAscii("list-my-endpoints"),
    owner: Cl.stringAscii(owner),
    timestamp: Cl.uint(timestamp),
  });
}

function createChallengeResponseMessage(owner: string, nonce: string, timestamp: number) {
  return Cl.tuple({
    action: Cl.stringAscii("challenge-response"),
    owner: Cl.stringAscii(owner),
    nonce: Cl.stringAscii(nonce),
    timestamp: Cl.uint(timestamp),
  });
}

async function signMessage(
  message: ReturnType<typeof Cl.tuple>,
  domain: ReturnType<typeof Cl.tuple>,
  privateKey: string
): Promise<string> {
  // Use stacks.js signStructuredData - returns string directly
  const signature = signStructuredData({
    message,
    domain,
    privateKey,
  });
  return signature;
}

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
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: unknown; headers: Headers }> {
  log(`Requesting ${method} ${endpoint}...`);

  const result = await makeX402RequestWithRetry(endpoint, method, x402Client, TOKEN_TYPE, {
    body,
    extraHeaders,
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

// =============================================================================
// Test Steps
// =============================================================================

interface TestContext {
  x402Client: X402PaymentClient;
  ownerAddress: string;
  privateKey: string;
  network: "mainnet" | "testnet";
  registeredEntryId?: string;
  // Second account for transfer testing (derived with index 1)
  account2Address: string;
  account2PrivateKey: string;
  account2Client: X402PaymentClient;
}

async function testProbe(ctx: TestContext): Promise<boolean> {
  logStep(1, 8, "Probe External Endpoint");

  try {
    const { status, data } = await makeX402Request(
      "/registry/probe",
      "POST",
      ctx.x402Client,
      { url: "https://stx402.com/api/ai/dad-joke" }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean; isX402Endpoint?: boolean; data?: unknown };
    if (!result.success) {
      logError(`Probe failed: ${JSON.stringify(data)}`);
      return false;
    }

    // Note: isX402Endpoint may be false if probing a non-x402 endpoint, that's OK for this test
    logSuccess(`Probed successfully - isX402Endpoint: ${result.isX402Endpoint}`);
    log("Probe data:", result.data);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testRegister(ctx: TestContext): Promise<boolean> {
  logStep(2, 8, "Register Test Endpoint");

  try {
    const { status, data } = await makeX402Request(
      "/registry/register",
      "POST",
      ctx.x402Client,
      {
        url: TEST_ENDPOINT_URL,
        name: TEST_ENDPOINT_NAME,
        description: TEST_ENDPOINT_DESCRIPTION,
        owner: ctx.ownerAddress,
        category: "test",
        tags: ["test", "lifecycle"],
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean; entry?: { id: string } };
    if (!result.success || !result.entry?.id) {
      logError(`Registration failed: ${JSON.stringify(data)}`);
      return false;
    }

    ctx.registeredEntryId = result.entry.id;
    logSuccess(`Registered with ID: ${ctx.registeredEntryId}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testList(ctx: TestContext): Promise<boolean> {
  logStep(3, 8, "List All Endpoints (Free)");

  try {
    // List is a free endpoint - no payment required
    const res = await fetch(`${X402_WORKER_URL}/registry/list`);
    const data = await res.json();

    if (res.status !== 200) {
      logError(`Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { entries: Array<{ url: string }> };
    if (!result.entries) {
      logError(`No entries array: ${JSON.stringify(data)}`);
      return false;
    }

    const found = result.entries.some((e) => e.url === TEST_ENDPOINT_URL);
    if (!found) {
      logError(`Our endpoint not found in list (${result.entries.length} total)`);
      return false;
    }

    logSuccess(`Listed ${result.entries.length} endpoints, found ours`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testDetails(ctx: TestContext): Promise<boolean> {
  logStep(4, 8, "Get Endpoint Details");

  try {
    const { status, data } = await makeX402Request(
      "/registry/details",
      "POST",
      ctx.x402Client,
      { url: TEST_ENDPOINT_URL }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { entry?: { name: string; owner: string } };
    if (!result.entry) {
      logError(`No entry in response: ${JSON.stringify(data)}`);
      return false;
    }

    if (result.entry.name !== TEST_ENDPOINT_NAME) {
      logError(`Name mismatch: ${result.entry.name}`);
      return false;
    }

    if (result.entry.owner !== ctx.ownerAddress) {
      logError(`Owner mismatch: ${result.entry.owner}`);
      return false;
    }

    logSuccess(`Details retrieved - owner: ${result.entry.owner}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testUpdate(ctx: TestContext): Promise<boolean> {
  logStep(5, 8, "Update Endpoint (Payment Auth)");

  try {
    const newDescription = "Updated description for lifecycle test";

    const { status, data } = await makeX402Request(
      "/registry/update",
      "POST",
      ctx.x402Client,
      {
        url: TEST_ENDPOINT_URL,
        owner: ctx.ownerAddress,
        description: newDescription,
        tags: ["test", "lifecycle", "updated"],
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean; entry?: { description: string }; verifiedBy?: string };
    if (!result.success) {
      logError(`Update failed: ${JSON.stringify(data)}`);
      return false;
    }

    logSuccess(`Updated - verified by: ${result.verifiedBy}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMyEndpoints(ctx: TestContext): Promise<boolean> {
  logStep(6, 8, "List My Endpoints (Signature Auth)");

  try {
    const timestamp = Date.now();
    const domain = getDomain(ctx.network);
    const message = createListMyEndpointsMessage(ctx.ownerAddress, timestamp);

    log("Signing message for my-endpoints...");
    const signature = await signMessage(message, domain, ctx.privateKey);

    const { status, data } = await makeX402Request(
      "/registry/my-endpoints",
      "POST",
      ctx.x402Client,
      {
        owner: ctx.ownerAddress,
        signature,
        timestamp,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { entries: Array<{ url: string }>; verifiedBy?: string };
    if (!result.entries) {
      logError(`No entries: ${JSON.stringify(data)}`);
      return false;
    }

    const found = result.entries.some((e) => e.url === TEST_ENDPOINT_URL);
    if (!found) {
      logError(`Our endpoint not in my-endpoints list`);
      return false;
    }

    logSuccess(`Found ${result.entries.length} owned endpoint(s) - verified by: ${result.verifiedBy}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

// Helper to sign a challenge using the hex domain/message from server
async function signChallenge(
  challengeData: { message: string; domain: string },
  privateKey: string
): Promise<string> {
  try {
    const domainHex = challengeData.domain;
    const messageHex = challengeData.message;

    log("Signing challenge with domain:", domainHex.substring(0, 40) + "...");
    log("Message:", messageHex.substring(0, 40) + "...");

    // Convert hex to ClarityValue objects
    const domain = hexToCV(domainHex);
    const message = hexToCV(messageHex);

    log("Domain type:", domain.type);
    log("Message type:", message.type);

    // Use signStructuredData - returns string directly
    const signature = signStructuredData({
      message,
      domain,
      privateKey,
    });

    log("Generated signature:", signature.substring(0, 20) + "...");
    return signature;
  } catch (error) {
    console.error("signChallenge error:", error);
    throw error;
  }
}

async function testTransfer(ctx: TestContext): Promise<boolean> {
  logStep(7, 8, "Transfer Ownership (Challenge-Response)");

  try {
    // Step 1: Request transfer without signature to get challenge
    log(`Transferring from ${ctx.ownerAddress} to ${ctx.account2Address}...`);
    const { status: challengeStatus, data: challengeData } = await makeX402Request(
      "/registry/transfer",
      "POST",
      ctx.x402Client,
      {
        url: TEST_ENDPOINT_URL,
        owner: ctx.ownerAddress,
        newOwner: ctx.account2Address,
      }
    );

    if (challengeStatus !== 200) {
      logError(`Challenge request failed: ${challengeStatus} ${JSON.stringify(challengeData)}`);
      return false;
    }

    const challenge = challengeData as {
      requiresSignature: boolean;
      challenge?: {
        challengeId: string;
        message: string;
        domain: string;
        expiresAt: number;
      };
    };

    if (!challenge.requiresSignature || !challenge.challenge) {
      logError(`No challenge in response: ${JSON.stringify(challengeData)}`);
      return false;
    }

    log(`Got challenge ID: ${challenge.challenge.challengeId}`);

    // Step 2: Sign the challenge with account 0's key (current owner)
    const signature = await signChallenge(challenge.challenge, ctx.privateKey);
    log("Signed challenge, signature length:", signature?.length);
    log("Submitting transfer with challengeId:", challenge.challenge.challengeId);

    // Step 3: Submit transfer with signature
    const transferBody = {
      url: TEST_ENDPOINT_URL,
      owner: ctx.ownerAddress,
      newOwner: ctx.account2Address,
      signature,
      challengeId: challenge.challenge.challengeId,
    };
    log("Transfer body:", JSON.stringify(transferBody).substring(0, 200) + "...");

    const { status: transferStatus, data: transferData } = await makeX402Request(
      "/registry/transfer",
      "POST",
      ctx.x402Client,
      transferBody
    );

    log("Transfer response status:", transferStatus);
    log("Transfer response:", JSON.stringify(transferData).substring(0, 200) + "...");

    if (transferStatus !== 200) {
      logError(`Transfer failed: ${transferStatus} ${JSON.stringify(transferData)}`);
      return false;
    }

    const result = transferData as {
      success?: boolean;
      requiresSignature?: boolean;
      transferred?: { from: string; to: string };
      verifiedBy?: string;
    };

    // Check if we got another challenge instead of success
    if (result.requiresSignature) {
      logError(`Server returned another challenge instead of processing signature`);
      return false;
    }

    if (!result.success) {
      logError(`Transfer not successful: ${JSON.stringify(transferData)}`);
      return false;
    }

    logSuccess(`Transferred from ${result.transferred?.from} to ${result.transferred?.to} - verified by: ${result.verifiedBy}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testDelete(ctx: TestContext): Promise<boolean> {
  logStep(8, 8, "Delete Endpoint as New Owner (Challenge-Response)");

  try {
    // Now account2 is the owner after transfer, so we use account2's credentials
    log(`Deleting as new owner: ${ctx.account2Address}...`);

    // Step 1: Request delete without signature to get challenge
    const { status: challengeStatus, data: challengeData } = await makeX402Request(
      "/registry/delete",
      "POST",
      ctx.account2Client, // Use account2's client for payment
      {
        url: TEST_ENDPOINT_URL,
        owner: ctx.account2Address, // New owner after transfer
      }
    );

    if (challengeStatus !== 200) {
      logError(`Challenge request failed: ${challengeStatus} ${JSON.stringify(challengeData)}`);
      return false;
    }

    const challenge = challengeData as {
      requiresSignature: boolean;
      challenge?: {
        challengeId: string;
        message: string;
        domain: string;
        expiresAt: number;
      };
    };

    if (!challenge.requiresSignature || !challenge.challenge) {
      logError(`No challenge in response: ${JSON.stringify(challengeData)}`);
      return false;
    }

    log(`Got challenge ID: ${challenge.challenge.challengeId}`);

    // Step 2: Sign with account2's key (new owner)
    const signature = await signChallenge(challenge.challenge, ctx.account2PrivateKey);
    log("Signed challenge, submitting delete...");

    // Step 3: Submit delete with signature
    const { status: deleteStatus, data: deleteData } = await makeX402Request(
      "/registry/delete",
      "POST",
      ctx.account2Client,
      {
        url: TEST_ENDPOINT_URL,
        owner: ctx.account2Address,
        signature,
        challengeId: challenge.challenge.challengeId,
      }
    );

    if (deleteStatus !== 200) {
      logError(`Delete failed: ${deleteStatus} ${JSON.stringify(deleteData)}`);
      return false;
    }

    const result = deleteData as { success: boolean; deleted?: { url: string }; verifiedBy?: string };
    if (!result.success) {
      logError(`Delete not successful: ${JSON.stringify(deleteData)}`);
      return false;
    }

    logSuccess(`Deleted - verified by: ${result.verifiedBy}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

// Cleanup function to ensure test endpoint is deleted even if tests fail
async function cleanup(ctx: TestContext): Promise<void> {
  console.log(`\n${COLORS.yellow}Cleanup: Attempting to delete test endpoint...${COLORS.reset}`);

  try {
    // Try to delete without signature first (will get challenge)
    // Then just let it expire - or we can try a simpler approach

    // Actually, let's just try the delete flow again
    // First check if the endpoint exists
    const res = await fetch(`${X402_WORKER_URL}/registry/list`);
    const data = await res.json() as { entries: Array<{ url: string }> };

    const exists = data.entries?.some((e) => e.url === TEST_ENDPOINT_URL);
    if (!exists) {
      console.log(`  ${COLORS.gray}Endpoint already deleted${COLORS.reset}`);
      return;
    }

    console.log(`  ${COLORS.gray}Endpoint still exists, manual cleanup may be needed${COLORS.reset}`);
    console.log(`  ${COLORS.gray}URL: ${TEST_ENDPOINT_URL}${COLORS.reset}`);
  } catch {
    // Ignore cleanup errors
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

export async function runRegistryLifecycle(verbose = false): Promise<LifecycleTestResult> {
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  REGISTRY LIFECYCLE TEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: Set X402_CLIENT_PK env var${COLORS.reset}`);
    process.exit(1);
  }

  // Validate network
  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    console.error(`${COLORS.red}Error: Invalid X402_NETWORK${COLORS.reset}`);
    process.exit(1);
  }

  const network: NetworkType = X402_NETWORK;

  // Initialize wallet - account 0 (primary)
  const { address, key } = await deriveChildAccount(network, X402_CLIENT_PK, 0);

  const x402Client = new X402PaymentClient({
    network,
    privateKey: key,
  });

  // Initialize wallet - account 1 (for transfer testing)
  const { address: address2, key: key2 } = await deriveChildAccount(network, X402_CLIENT_PK, 1);

  const x402Client2 = new X402PaymentClient({
    network,
    privateKey: key2,
  });

  console.log(`  Account 0: ${address}`);
  console.log(`  Account 1: ${address2}`);
  console.log(`  Network:   ${network}`);
  console.log(`  Server:    ${X402_WORKER_URL}`);
  console.log(`  Token:     ${TOKEN_TYPE}`);
  console.log(`  Test URL:  ${TEST_ENDPOINT_URL}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    privateKey: key,
    network,
    account2Address: address2,
    account2PrivateKey: key2,
    account2Client: x402Client2,
  };

  const results: Array<{ name: string; passed: boolean }> = [];

  try {
    // Run tests in sequence
    results.push({ name: "Probe", passed: await testProbe(ctx) });
    await sleep(500);

    results.push({ name: "Register", passed: await testRegister(ctx) });
    await sleep(500);

    if (results[1].passed) {
      results.push({ name: "List", passed: await testList(ctx) });
      await sleep(500);

      results.push({ name: "Details", passed: await testDetails(ctx) });
      await sleep(500);

      results.push({ name: "Update", passed: await testUpdate(ctx) });
      await sleep(500);

      results.push({ name: "My Endpoints", passed: await testMyEndpoints(ctx) });
      await sleep(500);

      results.push({ name: "Transfer", passed: await testTransfer(ctx) });
      await sleep(500);

      // Delete is now done by account2 (new owner after transfer)
      results.push({ name: "Delete", passed: await testDelete(ctx) });
    }
  } finally {
    // Cleanup
    await cleanup(ctx);
  }

  // Summary
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  RESULTS${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  for (const r of results) {
    const icon = r.passed ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
    console.log(`  ${icon} ${r.name}`);
  }

  const pct = ((passed / total) * 100).toFixed(1);
  console.log(`\n  ${passed}/${total} tests passed (${pct}%)`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}\n`);

  return { passed, total, success: passed === total };
}

// =============================================================================
// Main (when run directly)
// =============================================================================

if (import.meta.main) {
  runRegistryLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}
