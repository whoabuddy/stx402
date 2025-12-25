import { TokenType, X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { TEST_TOKENS, X402_CLIENT_PK, X402_NETWORK, X402_WORKER_URL, createTestLogger } from "./_shared_utils";

const X402_TEST_ADDRESS = "SPKH205E1MZMBRSQ07PCZN3A1RJCGSHY5P9CM1DR"; // Has BNS: stacks.btc
const X402_ENDPOINT = `/api/get-bns-name/${X402_TEST_ADDRESS}`;

interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

export async function testX402ManualFlow(verbose = false) {
  if (!X402_CLIENT_PK) {
    throw new Error(
      "Set X402_CLIENT_PK env var with testnet private key mnemonic"
    );
  }

  const { address, key } = await deriveChildAccount(
    X402_NETWORK,
    X402_CLIENT_PK,
    0
  );

  const logger = createTestLogger("get-bns-address", verbose);
  logger.info(`Test wallet address: ${address}`);

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK,
    privateKey: key,
  });

  const tokenResults: Record<string, boolean> = TEST_TOKENS.reduce((acc, t) => {
    acc[t] = false;
    return acc;
  }, {} as Record<string, boolean>);

  for (const tokenType of TEST_TOKENS) {
    logger.info(`--- Testing ${tokenType} ---`);
    const endpoint = `${X402_ENDPOINT}?tokenType=${tokenType}`;

    logger.info("1. Initial request (expect 402)...");
    const initialRes = await fetch(`${X402_WORKER_URL}${endpoint}`);
    if (initialRes.status !== 402) {
      throw new Error(
        `Expected 402, got ${initialRes.status}: ${await initialRes.text()}`
      );
    }

    const paymentReq: X402PaymentRequired = await initialRes.json();
    logger.debug("402 Payment req", paymentReq);

    if (paymentReq.tokenType !== tokenType)
      throw new Error(`Expected tokenType ${tokenType}`);

    const signResult = await x402Client.signPayment(paymentReq);
    logger.debug("Signed payment", signResult);

    logger.info("2. Retry with X-PAYMENT...");
    const retryRes = await fetch(`${X402_WORKER_URL}${endpoint}`, {
      headers: {
        "X-PAYMENT": signResult.signedTransaction,
        "X-PAYMENT-TOKEN-TYPE": tokenType,
      },
    });

    logger.info(`Retry status: ${retryRes.status}`);
    if (retryRes.status !== 200) {
      const errText = await retryRes.text();
      logger.error(`Retry failed for ${tokenType} (${retryRes.status}): ${errText}`);
      logger.debug("Payment req", paymentReq);
      continue;
    }

    const data = await retryRes.json();
    const name = data.name;
    logger.success(`BNS "${name}" for ${tokenType}`);

    if (name !== "stacks.btc") {
      logger.error(`Expected "stacks.btc", got "${name}" for ${tokenType}`);
      logger.debug("Full response", data);
      continue;
    }
    tokenResults[tokenType] = true;

    const paymentResp = retryRes.headers.get("x-payment-response");
    if (paymentResp) {
      const info = JSON.parse(paymentResp);
      logger.debug("Payment confirmed", info);
    }
  }
  const successCount = Object.values(tokenResults).filter(v => v).length;
  logger.summary(successCount, TEST_TOKENS.length);
  return { tokenResults };
}
