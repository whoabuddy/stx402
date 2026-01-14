import { TokenType, X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { createTestLogger, X402_CLIENT_PK, X402_NETWORK, X402_WORKER_URL } from "./_shared_utils";

interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

async function makeX402Request(
  x402Client: X402PaymentClient,
  endpoint: string,
  method: "GET" | "POST",
  body: any,
  tokenType: TokenType,
  logger: ReturnType<typeof createTestLogger>
): Promise<{ status: number; data: any }> {
  const url = `${X402_WORKER_URL}${endpoint}?tokenType=${tokenType}&network=testnet`;

  // First request - expect 402
  const initialRes = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (initialRes.status !== 402) {
    const text = await initialRes.text();
    try {
      return { status: initialRes.status, data: JSON.parse(text) };
    } catch {
      return { status: initialRes.status, data: text };
    }
  }

  const paymentReq: X402PaymentRequired = await initialRes.json();
  logger.debug("402 Payment req", paymentReq);

  const signResult = await x402Client.signPayment(paymentReq);
  logger.debug("Signed payment", signResult);

  // Retry with payment
  const retryRes = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": signResult.signedTransaction,
      "X-PAYMENT-TOKEN-TYPE": tokenType,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await retryRes.json().catch(() => retryRes.text());
  return { status: retryRes.status, data };
}

export interface LifecycleTestResult {
  passed: number;
  total: number;
  success: boolean;
}

export async function runAgentLifecycle(verbose = false): Promise<LifecycleTestResult> {
  if (!X402_CLIENT_PK) {
    throw new Error("Set X402_CLIENT_PK env var with testnet private key mnemonic");
  }

  const { address, key } = await deriveChildAccount(X402_NETWORK, X402_CLIENT_PK, 0);
  const logger = createTestLogger("agent-registry", verbose);
  logger.info(`Test wallet address: ${address}`);

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK,
    privateKey: key,
  });

  const tokenType: TokenType = "STX";
  let successCount = 0;
  const totalTests = 8;

  // Test 1: Free endpoint - /agent/registry
  logger.info("1. Testing /agent/registry (free)...");
  try {
    const res = await fetch(`${X402_WORKER_URL}/agent/registry`);
    const data = await res.json();

    if (res.status === 200 && data.networks?.testnet?.identity) {
      logger.success(`Got registry info: ${data.networks.testnet.deployer}`);
      successCount++;
    } else {
      logger.error(`Registry info failed: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    logger.error(`Registry info error: ${err}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 2: Agent info for agent ID 0 (first registered agent)
  logger.info("2. Testing /agent/info...");
  const infoResult = await makeX402Request(
    x402Client,
    "/agent/info",
    "POST",
    { agentId: 0 },
    tokenType,
    logger
  );

  if (infoResult.status === 200 && infoResult.data.owner) {
    logger.success(`Agent 0 owner: ${infoResult.data.owner}`);
    successCount++;
  } else if (infoResult.status === 404) {
    logger.success(`Agent 0 not found (expected if no agents registered)`);
    successCount++;
  } else {
    logger.error(`Agent info failed: ${JSON.stringify(infoResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 3: Agent owner lookup
  logger.info("3. Testing /agent/owner...");
  const ownerResult = await makeX402Request(
    x402Client,
    "/agent/owner?agentId=0",
    "GET",
    null,
    tokenType,
    logger
  );

  if (ownerResult.status === 200 && ownerResult.data.owner) {
    logger.success(`Got owner for agent 0: ${ownerResult.data.owner}`);
    successCount++;
  } else if (ownerResult.status === 404) {
    logger.success(`Agent 0 not found (expected if no agents registered)`);
    successCount++;
  } else {
    logger.error(`Owner lookup failed: ${JSON.stringify(ownerResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 4: Agent version
  logger.info("4. Testing /agent/version...");
  const versionResult = await makeX402Request(
    x402Client,
    "/agent/version",
    "GET",
    null,
    tokenType,
    logger
  );

  if (versionResult.status === 200 && versionResult.data.version) {
    logger.success(`Identity registry version: ${versionResult.data.version}`);
    successCount++;
  } else {
    logger.error(`Version lookup failed: ${JSON.stringify(versionResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 5: Reputation summary for agent 0
  logger.info("5. Testing /agent/reputation/summary...");
  const repSummaryResult = await makeX402Request(
    x402Client,
    "/agent/reputation/summary",
    "POST",
    { agentId: 0 },
    tokenType,
    logger
  );

  if (repSummaryResult.status === 200 && typeof repSummaryResult.data.count === "number") {
    logger.success(`Agent 0 reputation: ${repSummaryResult.data.count} feedbacks, avg ${repSummaryResult.data.averageScore}`);
    successCount++;
  } else if (repSummaryResult.status === 404) {
    logger.success(`Agent 0 not found for reputation (expected if no agents)`);
    successCount++;
  } else {
    logger.error(`Reputation summary failed: ${JSON.stringify(repSummaryResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 6: Reputation clients for agent 0
  logger.info("6. Testing /agent/reputation/clients...");
  const repClientsResult = await makeX402Request(
    x402Client,
    "/agent/reputation/clients",
    "POST",
    { agentId: 0 },
    tokenType,
    logger
  );

  if (repClientsResult.status === 200 && Array.isArray(repClientsResult.data.clients)) {
    logger.success(`Agent 0 has ${repClientsResult.data.count} feedback clients`);
    successCount++;
  } else if (repClientsResult.status === 404) {
    logger.success(`Agent 0 not found (expected if no agents)`);
    successCount++;
  } else {
    logger.error(`Reputation clients failed: ${JSON.stringify(repClientsResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 7: Validation summary for agent 0
  logger.info("7. Testing /agent/validation/summary...");
  const valSummaryResult = await makeX402Request(
    x402Client,
    "/agent/validation/summary",
    "POST",
    { agentId: 0 },
    tokenType,
    logger
  );

  if (valSummaryResult.status === 200 && typeof valSummaryResult.data.count === "number") {
    logger.success(`Agent 0 validations: ${valSummaryResult.data.count} total`);
    successCount++;
  } else if (valSummaryResult.status === 404) {
    logger.success(`Agent 0 not found for validation (expected if no agents)`);
    successCount++;
  } else {
    logger.error(`Validation summary failed: ${JSON.stringify(valSummaryResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 8: Agent lookup by owner
  logger.info("8. Testing /agent/lookup...");
  const testDeployer = "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18";
  const lookupResult = await makeX402Request(
    x402Client,
    "/agent/lookup",
    "POST",
    { owner: testDeployer, maxScan: 10 },
    tokenType,
    logger
  );

  if (lookupResult.status === 200 && Array.isArray(lookupResult.data.agents)) {
    logger.success(`Found ${lookupResult.data.count} agents for ${testDeployer.slice(0, 10)}...`);
    successCount++;
  } else {
    logger.error(`Agent lookup failed: ${JSON.stringify(lookupResult.data)}`);
  }

  logger.summary(successCount, totalTests);
  return { passed: successCount, total: totalTests, success: successCount === totalTests };
}

// Legacy export for backwards compatibility
export const testAgentRegistryEndpoints = runAgentLifecycle;

// Run if executed directly
if (import.meta.main) {
  const verbose = process.argv.includes("-v") || process.argv.includes("--verbose");
  runAgentLifecycle(verbose)
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
