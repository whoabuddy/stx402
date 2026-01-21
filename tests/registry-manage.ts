/**
 * Registry Management Script
 *
 * List and delete your own registered endpoints.
 *
 * Usage:
 *   bun run tests/registry-manage.ts list
 *   bun run tests/registry-manage.ts delete <url> [url...]
 *
 * Environment:
 *   X402_CLIENT_PK  - Client mnemonic (your wallet)
 *   X402_NETWORK    - "mainnet" or "testnet" (default: mainnet)
 *   X402_WORKER_URL - API URL (default: https://stx402.com)
 *   VERBOSE=1       - Enable verbose logging
 */

import { X402PaymentClient, X402_HEADERS } from "x402-stacks";
import type { TokenType, NetworkType, PaymentRequiredV2 } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { hexToCV, signStructuredData } from "@stacks/transactions";
import { COLORS, X402_CLIENT_PK, buildPaymentPayloadV2 } from "./_shared_utils";

// Override defaults for registry management (mainnet + production)
const X402_NETWORK = (process.env.X402_NETWORK || "mainnet") as NetworkType;
const X402_WORKER_URL = process.env.X402_WORKER_URL || "https://stx402.com";

// =============================================================================
// Configuration
// =============================================================================

const VERBOSE = process.env.VERBOSE === "1";
const TOKEN_TYPE: TokenType = "STX";

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
${COLORS.bright}Registry Management${COLORS.reset}

${COLORS.cyan}Usage:${COLORS.reset}
  bun run tests/registry-manage.ts list                    List your registered endpoints
  bun run tests/registry-manage.ts delete <url> [url...]   Delete one or more endpoints

${COLORS.cyan}Environment:${COLORS.reset}
  X402_CLIENT_PK  Client mnemonic (required)
  X402_NETWORK    "mainnet" or "testnet" (default: mainnet)
  X402_WORKER_URL API URL (default: https://stx402.com)
  VERBOSE=1       Enable verbose logging

${COLORS.cyan}Examples:${COLORS.reset}
  X402_CLIENT_PK="..." bun run tests/registry-manage.ts list
  X402_CLIENT_PK="..." bun run tests/registry-manage.ts delete https://example.com/api/endpoint
  X402_CLIENT_PK="..." bun run tests/registry-manage.ts delete https://a.com/api https://b.com/api

  # Against testnet/staging
  X402_NETWORK=testnet X402_WORKER_URL=http://localhost:8787 X402_CLIENT_PK="..." bun run tests/registry-manage.ts list
`);
}

// =============================================================================
// X402 V2 Payment Flow
// =============================================================================

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

  // Parse V2 payment requirements
  const paymentText = await initialRes.text();
  const paymentReq: PaymentRequiredV2 = JSON.parse(paymentText);

  if (paymentReq.x402Version !== 2 || !paymentReq.accepts?.length) {
    return { status: 400, data: { error: "Invalid V2 payment requirements" }, headers: initialRes.headers };
  }

  const requirements = paymentReq.accepts[0];
  log(`Payment required: ${requirements.amount} ${requirements.asset}`);

  // Build V1-compatible request for the client
  const v1Request = {
    maxAmountRequired: requirements.amount,
    resource: paymentReq.resource.url,
    payTo: requirements.payTo,
    network: X402_NETWORK as "mainnet" | "testnet",
    nonce: (requirements.extra?.nonce as string) || crypto.randomUUID(),
    expiresAt: new Date(Date.now() + requirements.maxTimeoutSeconds * 1000).toISOString(),
    tokenType: (requirements.extra?.tokenType as TokenType) || TOKEN_TYPE,
    ...(requirements.extra?.tokenContract && { tokenContract: requirements.extra.tokenContract }),
  };

  // Sign payment
  const signResult = await x402Client.signPayment(v1Request);
  log("Payment signed");

  // Build V2 payload and retry
  const paymentPayload = buildPaymentPayloadV2(signResult.signedTransaction, requirements);
  const encodedPayload = btoa(JSON.stringify(paymentPayload));

  const paidRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      [X402_HEADERS.PAYMENT_SIGNATURE]: encodedPayload,
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

// =============================================================================
// Signature Helpers
// =============================================================================

async function signChallenge(
  challengeData: { message: string; domain: string },
  privateKey: string
): Promise<string> {
  const domain = hexToCV(challengeData.domain);
  const message = hexToCV(challengeData.message);

  log("Signing challenge...");
  log("Domain type:", domain.type);
  log("Message type:", message.type);

  const signature = signStructuredData({
    message,
    domain,
    privateKey,
  });

  log("Generated signature:", signature.substring(0, 20) + "...");
  return signature;
}

// =============================================================================
// Commands
// =============================================================================

interface OwnedEntry {
  id: string;
  url: string;
  name: string;
  description?: string;
  category?: string;
  status: string;
  tags?: string[];
  registeredAt: string;
  updatedAt?: string;
  probeData?: {
    paymentAddress?: string;
    acceptedTokens?: string[];
    responseTimeMs?: number;
  };
}

async function listMyEndpoints(
  x402Client: X402PaymentClient,
  ownerAddress: string
): Promise<boolean> {
  console.log(`\n${COLORS.bright}Your Registered Endpoints${COLORS.reset}\n`);

  // Payment-based auth: just pay from the owner address, no signature needed
  const { status, data } = await makeX402Request(
    "/registry/my-endpoints",
    "POST",
    x402Client,
    { owner: ownerAddress }
  );

  if (status === 403) {
    logError(`Authentication failed`);
    console.log(JSON.stringify(data, null, 2));
    return false;
  }

  if (status !== 200) {
    logError(`Request failed: ${status}`);
    console.log(JSON.stringify(data, null, 2));
    return false;
  }

  const result = data as { entries: OwnedEntry[]; count: number; authenticatedBy: string };

  console.log(`${COLORS.gray}Authenticated by: ${result.authenticatedBy}${COLORS.reset}\n`);

  if (result.count === 0) {
    console.log(`${COLORS.gray}No registered endpoints${COLORS.reset}`);
    return true;
  }

  console.log(`${COLORS.cyan}Found ${result.count} endpoint(s):${COLORS.reset}\n`);

  for (const entry of result.entries) {
    const statusColor = entry.status === "verified"
      ? COLORS.green
      : entry.status === "rejected"
        ? COLORS.red
        : COLORS.yellow;

    console.log(`${COLORS.bright}${entry.name}${COLORS.reset} ${statusColor}[${entry.status}]${COLORS.reset}`);
    console.log(`  URL:      ${entry.url}`);
    console.log(`  Category: ${entry.category || "none"}`);
    if (entry.tags?.length) {
      console.log(`  Tags:     ${entry.tags.join(", ")}`);
    }
    console.log(`  Registered: ${entry.registeredAt}`);
    if (entry.updatedAt && entry.updatedAt !== entry.registeredAt) {
      console.log(`  Updated:    ${entry.updatedAt}`);
    }
    if (entry.probeData?.paymentAddress) {
      console.log(`  Pay To:   ${entry.probeData.paymentAddress}`);
    }
    console.log();
  }

  return true;
}

async function deleteEndpoint(
  x402Client: X402PaymentClient,
  ownerAddress: string,
  privateKey: string,
  url: string
): Promise<boolean> {
  console.log(`\n${COLORS.bright}Deleting Endpoint${COLORS.reset}\n`);
  console.log(`  URL: ${url}`);
  console.log(`  Owner: ${ownerAddress}\n`);

  // Step 1: Request delete without signature to get challenge
  log("Requesting delete challenge...");
  const { status: challengeStatus, data: challengeData } = await makeX402Request(
    "/registry/delete",
    "POST",
    x402Client,
    { url, owner: ownerAddress }
  );

  if (challengeStatus === 404) {
    logError(`Endpoint not found in registry`);
    return false;
  }

  if (challengeStatus === 403) {
    logError(`Not authorized - you are not the owner of this endpoint`);
    const result = challengeData as { registeredOwner?: string };
    if (result.registeredOwner) {
      console.log(`  Registered owner: ${result.registeredOwner}`);
    }
    return false;
  }

  if (challengeStatus !== 200) {
    logError(`Challenge request failed: ${challengeStatus}`);
    console.log(JSON.stringify(challengeData, null, 2));
    return false;
  }

  const challenge = challengeData as {
    requiresSignature?: boolean;
    success?: boolean;
    challenge?: {
      challengeId: string;
      message: string;
      domain: string;
      expiresAt: number;
    };
  };

  // If already deleted (shouldn't happen but handle it)
  if (challenge.success) {
    logSuccess(`Endpoint deleted`);
    return true;
  }

  if (!challenge.requiresSignature || !challenge.challenge) {
    logError(`Unexpected response - no challenge provided`);
    console.log(JSON.stringify(challengeData, null, 2));
    return false;
  }

  log(`Got challenge ID: ${challenge.challenge.challengeId}`);
  log(`Expires at: ${new Date(challenge.challenge.expiresAt).toISOString()}`);

  // Step 2: Sign the challenge
  const signature = await signChallenge(challenge.challenge, privateKey);

  // Step 3: Submit delete with signature
  log("Submitting signed delete request...");
  const { status: deleteStatus, data: deleteData } = await makeX402Request(
    "/registry/delete",
    "POST",
    x402Client,
    {
      url,
      owner: ownerAddress,
      signature,
      challengeId: challenge.challenge.challengeId,
    }
  );

  if (deleteStatus === 403) {
    logError(`Signature verification failed`);
    console.log(JSON.stringify(deleteData, null, 2));
    return false;
  }

  if (deleteStatus !== 200) {
    logError(`Delete failed: ${deleteStatus}`);
    console.log(JSON.stringify(deleteData, null, 2));
    return false;
  }

  const result = deleteData as {
    success: boolean;
    deleted?: { id: string; url: string; name: string };
    verifiedBy?: string;
  };

  if (!result.success) {
    logError(`Delete not successful`);
    console.log(JSON.stringify(deleteData, null, 2));
    return false;
  }

  logSuccess(`Deleted: ${result.deleted?.name || url}`);
  console.log(`  ${COLORS.gray}Verified by: ${result.verifiedBy}${COLORS.reset}`);
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

  if (!X402_CLIENT_PK) {
    logError("X402_CLIENT_PK environment variable is required");
    printUsage();
    process.exit(1);
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    logError(`Invalid X402_NETWORK: ${X402_NETWORK}`);
    process.exit(1);
  }

  // Initialize wallet
  const { address: ownerAddress, key: privateKey } = await deriveChildAccount(
    X402_NETWORK,
    X402_CLIENT_PK,
    0
  );

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK,
    privateKey,
  });

  console.log(`${COLORS.gray}Owner: ${ownerAddress}${COLORS.reset}`);
  console.log(`${COLORS.gray}Network: ${X402_NETWORK}${COLORS.reset}`);
  console.log(`${COLORS.gray}Server: ${X402_WORKER_URL}${COLORS.reset}`);

  let success = false;

  switch (command) {
    case "list":
      success = await listMyEndpoints(x402Client, ownerAddress);
      break;

    case "delete": {
      const urls = args.slice(1);
      if (urls.length === 0) {
        logError(`At least one URL is required for delete command`);
        printUsage();
        process.exit(1);
      }

      let successCount = 0;
      for (const url of urls) {
        const result = await deleteEndpoint(x402Client, ownerAddress, privateKey, url);
        if (result) successCount++;
      }

      console.log(`\n${COLORS.bright}Summary:${COLORS.reset} ${successCount}/${urls.length} deleted successfully`);
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
