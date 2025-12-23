import { TokenType, X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";

const X402_CLIENT_PK = process.env.X402_CLIENT_PK;
const X402_NETWORK = process.env.X402_NETWORK || "testnet";

const X402_WORKER_URL = "https://stx402.chaos.workers.dev";
//const X402_WORKER_URL = "http://localhost:8787";
const X402_TEST_ADDRESS = "SPKH205E1MZMBRSQ07PCZN3A1RJCGSHY5P9CM1DR"; // Mainnet address for conversion test
const X402_ENDPOINT = `/api/convert-address-to-network/${X402_TEST_ADDRESS}`;

interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

async function testX402ManualFlow() {
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

  console.log("  test address:", address);

  const x402Client = new X402PaymentClient({
    network: "testnet",
    privateKey: key,
  });

  for (const tokenType of ["STX", "sBTC"] as const) {
    console.log(`\n--- Testing with tokenType: ${tokenType} ---`);
    const endpoint = `${X402_ENDPOINT}?tokenType=${tokenType}&network=testnet`;

    console.log("1. Initial request (expect 402)...");
    const initialRes = await fetch(`${X402_WORKER_URL}${endpoint}`);
    if (initialRes.status !== 402) {
      throw new Error(
        `Expected 402, got ${initialRes.status}: ${await initialRes.text()}`
      );
    }

    const paymentReq: X402PaymentRequired = await initialRes.json();
    console.log("402 Payment req:", paymentReq);

    if (paymentReq.tokenType !== tokenType)
      throw new Error(`Expected tokenType ${tokenType}`);

    const signResult = await x402Client.signPayment(paymentReq);

    console.log("3. Retry with X-PAYMENT...");
    const retryRes = await fetch(`${X402_WORKER_URL}${endpoint}`, {
      headers: {
        "X-PAYMENT": signResult.signedTransaction,
        "X-PAYMENT-TOKEN-TYPE": tokenType,
      },
    });

    console.log("Retry status:", retryRes.status);
    if (retryRes.status !== 200) {
      console.error("Failed:", await retryRes.text());
      return;
    }

    const data = await retryRes.json();
    console.log("✅ Data:", JSON.stringify(data, null, 2));

    if (!data.convertedAddress || !data.network || data.network !== "testnet") {
      console.error("Expected convertedAddress and network=testnet");
      return;
    }

    const paymentResp = retryRes.headers.get("x-payment-response");
    if (paymentResp) {
      const info = JSON.parse(paymentResp);
      console.log("Payment confirmed:", info);
    }

    console.log("🎉 FULL SUCCESS: Paid → Got converted address!");
  }
}

testX402ManualFlow().catch((e) => console.error("❌ Error:", e));
