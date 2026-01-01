/**
 * Registry Cleanup Script
 *
 * Removes all test registry entries owned by the test wallets (account 0 and account 1).
 * Uses the challenge-response flow to properly authenticate deletions.
 *
 * Usage:
 *   bun run tests/cleanup-registry.ts
 *
 * Environment:
 *   X402_CLIENT_PK  - Testnet mnemonic (required)
 *   X402_WORKER_URL - Worker URL (default: http://localhost:8787)
 *   VERBOSE=1       - Enable verbose logging
 */

import type { TokenType, NetworkType } from "x402-stacks";
import { X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { hexToCV, signStructuredData } from "@stacks/transactions";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
} from "./_shared_utils";

const VERBOSE = process.env.VERBOSE === "1";
const TOKEN_TYPE: TokenType = "STX";

function log(message: string, ...args: unknown[]) {
  if (VERBOSE) {
    console.log(`  ${COLORS.gray}${message}${COLORS.reset}`, ...args);
  }
}

interface RegistryEntry {
  id: string;
  url: string;
  name: string;
  owner: string;
  category?: string;
  status: string;
}

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
  const tokenParam = endpoint.includes("?")
    ? `&tokenType=${TOKEN_TYPE}`
    : `?tokenType=${TOKEN_TYPE}`;

  log(`Requesting ${method} ${endpoint}...`);

  const initialRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

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

  // Handle 402 payment required
  const paymentText = await initialRes.text();
  const paymentReq: PaymentRequired = JSON.parse(paymentText);
  log(`Payment required: ${paymentReq.maxAmountRequired} ${paymentReq.tokenType}`);

  const signResult = await x402Client.signPayment(paymentReq);
  log("Payment signed");

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

async function signChallenge(
  challengeData: { message: string; domain: string },
  privateKey: string
): Promise<string> {
  const domain = hexToCV(challengeData.domain);
  const message = hexToCV(challengeData.message);
  return signStructuredData({ message, domain, privateKey });
}

async function deleteEntry(
  entry: RegistryEntry,
  privateKey: string,
  x402Client: X402PaymentClient
): Promise<boolean> {
  try {
    // Step 1: Request delete to get challenge
    const { status: challengeStatus, data: challengeData } = await makeX402Request(
      "/api/registry/delete",
      "POST",
      x402Client,
      { url: entry.url, owner: entry.owner }
    );

    if (challengeStatus !== 200) {
      console.log(`  ${COLORS.red}Failed to get challenge: ${challengeStatus}${COLORS.reset}`);
      log("Response:", JSON.stringify(challengeData));
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
      console.log(`  ${COLORS.red}No challenge received${COLORS.reset}`);
      return false;
    }

    // Step 2: Sign the challenge
    const signature = await signChallenge(challenge.challenge, privateKey);
    log("Signed challenge");

    // Step 3: Submit delete with signature
    const { status: deleteStatus, data: deleteData } = await makeX402Request(
      "/api/registry/delete",
      "POST",
      x402Client,
      {
        url: entry.url,
        owner: entry.owner,
        signature,
        challengeId: challenge.challenge.challengeId,
      }
    );

    if (deleteStatus !== 200) {
      console.log(`  ${COLORS.red}Delete failed: ${deleteStatus}${COLORS.reset}`);
      log("Response:", JSON.stringify(deleteData));
      return false;
    }

    const result = deleteData as { success: boolean };
    return result.success;
  } catch (error) {
    console.log(`  ${COLORS.red}Exception: ${error}${COLORS.reset}`);
    return false;
  }
}

async function main() {
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  REGISTRY CLEANUP${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: Set X402_CLIENT_PK env var${COLORS.reset}`);
    process.exit(1);
  }

  const network: NetworkType =
    X402_NETWORK === "mainnet" || X402_NETWORK === "testnet"
      ? X402_NETWORK
      : "testnet";

  // Derive both test wallet addresses
  const { address: address0, key: key0 } = await deriveChildAccount(network, X402_CLIENT_PK, 0);
  const { address: address1, key: key1 } = await deriveChildAccount(network, X402_CLIENT_PK, 1);

  const x402Client0 = new X402PaymentClient({ network, privateKey: key0 });
  const x402Client1 = new X402PaymentClient({ network, privateKey: key1 });

  console.log(`  Test Wallet 0: ${address0}`);
  console.log(`  Test Wallet 1: ${address1}`);
  console.log(`  Network:       ${network}`);
  console.log(`  Server:        ${X402_WORKER_URL}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}\n`);

  // Fetch all registry entries
  console.log(`${COLORS.cyan}Fetching registry entries...${COLORS.reset}`);
  const listRes = await fetch(`${X402_WORKER_URL}/api/registry/list`);
  const listData = (await listRes.json()) as { entries: RegistryEntry[]; total: number };

  if (!listData.entries || listData.entries.length === 0) {
    console.log(`${COLORS.yellow}No entries in registry${COLORS.reset}`);
    process.exit(0);
  }

  console.log(`Found ${listData.total} total entries\n`);

  // Find entries owned by test wallets
  const testAddresses = new Set([address0, address1]);
  const testEntries = listData.entries.filter((e) => testAddresses.has(e.owner));

  if (testEntries.length === 0) {
    console.log(`${COLORS.green}No test entries found - registry is clean!${COLORS.reset}`);
    process.exit(0);
  }

  console.log(`${COLORS.yellow}Found ${testEntries.length} test entries to delete:${COLORS.reset}`);
  for (const entry of testEntries) {
    const isWallet0 = entry.owner === address0;
    console.log(`  - ${entry.name || entry.url} (owner: wallet ${isWallet0 ? "0" : "1"})`);
  }
  console.log();

  // Delete each test entry
  let deleted = 0;
  let failed = 0;

  for (const entry of testEntries) {
    const isWallet0 = entry.owner === address0;
    const privateKey = isWallet0 ? key0 : key1;
    const x402Client = isWallet0 ? x402Client0 : x402Client1;

    console.log(`${COLORS.cyan}Deleting:${COLORS.reset} ${entry.name || entry.url}`);

    const success = await deleteEntry(entry, privateKey, x402Client);

    if (success) {
      console.log(`  ${COLORS.green}✓ Deleted${COLORS.reset}`);
      deleted++;
    } else {
      console.log(`  ${COLORS.red}✗ Failed${COLORS.reset}`);
      failed++;
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  // Summary
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  CLEANUP COMPLETE${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`  ${COLORS.green}Deleted: ${deleted}${COLORS.reset}`);
  if (failed > 0) {
    console.log(`  ${COLORS.red}Failed:  ${failed}${COLORS.reset}`);
  }
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
  process.exit(1);
});
