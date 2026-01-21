import { X402PaymentClient, X402_HEADERS } from "x402-stacks";
import type { TokenType, PaymentRequiredV2, PaymentRequirementsV2 } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { createTestLogger, X402_CLIENT_PK, X402_NETWORK, X402_WORKER_URL, buildPaymentPayloadV2 } from "./_shared_utils";

async function makeX402Request(
  x402Client: X402PaymentClient,
  endpoint: string,
  method: "GET" | "POST",
  body: unknown,
  tokenType: TokenType,
  logger: ReturnType<typeof createTestLogger>
): Promise<{ status: number; data: unknown }> {
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

  // Parse V2 payment requirements
  const paymentReq: PaymentRequiredV2 = await initialRes.json();
  logger.debug("402 Payment req (V2)", paymentReq);

  if (paymentReq.x402Version !== 2 || !paymentReq.accepts?.length) {
    return { status: 400, data: { error: "Invalid V2 payment requirements" } };
  }

  const requirements = paymentReq.accepts[0];

  // Build V1-compatible request for the client
  const v1Request = {
    maxAmountRequired: requirements.amount,
    resource: paymentReq.resource.url,
    payTo: requirements.payTo,
    network: X402_NETWORK as "mainnet" | "testnet",
    nonce: (requirements.extra?.nonce as string) || crypto.randomUUID(),
    expiresAt: new Date(Date.now() + requirements.maxTimeoutSeconds * 1000).toISOString(),
    tokenType: (requirements.extra?.tokenType as TokenType) || tokenType,
    ...(requirements.extra?.tokenContract && { tokenContract: requirements.extra.tokenContract }),
  };

  const signResult = await x402Client.signPayment(v1Request);
  logger.debug("Signed payment", signResult);

  // Build V2 payload and retry
  const paymentPayload = buildPaymentPayloadV2(signResult.signedTransaction, requirements);
  const encodedPayload = btoa(JSON.stringify(paymentPayload));

  const retryRes = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      [X402_HEADERS.PAYMENT_SIGNATURE]: encodedPayload,
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

  if (infoResult.status === 200 && (infoResult.data as { owner?: string }).owner) {
    logger.success(`Agent 0 owner: ${(infoResult.data as { owner: string }).owner}`);
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

  if (ownerResult.status === 200 && (ownerResult.data as { owner?: string }).owner) {
    logger.success(`Got owner for agent 0: ${(ownerResult.data as { owner: string }).owner}`);
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

  if (versionResult.status === 200 && (versionResult.data as { version?: string }).version) {
    logger.success(`Identity registry version: ${(versionResult.data as { version: string }).version}`);
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

  const repData = repSummaryResult.data as { count?: number; averageScore?: number };
  if (repSummaryResult.status === 200 && typeof repData.count === "number") {
    logger.success(`Agent 0 reputation: ${repData.count} feedbacks, avg ${repData.averageScore}`);
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

  const clientsData = repClientsResult.data as { clients?: unknown[]; count?: number };
  if (repClientsResult.status === 200 && Array.isArray(clientsData.clients)) {
    logger.success(`Agent 0 has ${clientsData.count} feedback clients`);
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

  const valData = valSummaryResult.data as { count?: number };
  if (valSummaryResult.status === 200 && typeof valData.count === "number") {
    logger.success(`Agent 0 validations: ${valData.count} total`);
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

  const lookupData = lookupResult.data as { agents?: unknown[]; count?: number };
  if (lookupResult.status === 200 && Array.isArray(lookupData.agents)) {
    logger.success(`Found ${lookupData.count} agents for ${testDeployer.slice(0, 10)}...`);
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
