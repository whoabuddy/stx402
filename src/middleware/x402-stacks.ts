import type { Context } from "hono";
import { X402PaymentVerifier, STXtoMicroSTX } from "x402-stacks";

export interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType?: "STX" | "sBTC";
}

export interface SettlePaymentResult {
  isValid: boolean;
  txId?: string;
  status?: string;
  blockHeight?: number;
}

export const x402PaymentMiddleware = () => {
  return async (
    c: Context<{ Bindings: Env }>,
    next: () => Promise<Response | void>
  ) => {
    const config = {
      amountStx: c.env.X402_PAYMENT_AMOUNT_STX,
      address: c.env.X402_SERVER_ADDRESS,
      network: c.env.X402_NETWORK as "mainnet" | "testnet",
      facilitatorUrl: c.env.X402_FACILITATOR_URL,
    };

    const verifier = new X402PaymentVerifier(
      config.facilitatorUrl,
      config.network
    );
    const signedTx = c.req.header("X-PAYMENT");
    const tokenType =
      (c.req.header("X-PAYMENT-TOKEN-TYPE") as "STX" | "sBTC") || "STX";

    if (!signedTx) {
      // Respond 402 with payment request
      const paymentRequest: X402PaymentRequired = {
        maxAmountRequired: STXtoMicroSTX(config.amountStx).toString(),
        resource: c.req.path,
        payTo: config.address,
        network: config.network,
        nonce: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        tokenType,
      };

      return c.json(paymentRequest, 402);
    }

    console.log("=== X402 DEBUG START ===");
    console.log("Path:", c.req.path);
    console.log("SignedTx preview:", signedTx.slice(0, 100) + "...");
    console.log("SignedTx length:", signedTx.length);
    console.log("TokenType:", tokenType);
    console.log("Config amountStx:", config.amountStx);
    console.log("Config address:", config.address);
    console.log("Config network:", config.network);

    // Verify/settle payment
    let settleResult: SettlePaymentResult;
    try {
      settleResult = (await verifier.settlePayment(signedTx, {
        expectedRecipient: config.address,
        minAmount: STXtoMicroSTX(config.amountStx),
        tokenType,
      })) as SettlePaymentResult;
    } catch (error) {
      console.error("settlePayment error:", error);
      console.log("=== X402 DEBUG END (ERROR) ===");
      return c.json({ error: "Payment settlement failed", details: String(error) }, 402);
    }

    console.log("SettleResult:", JSON.stringify(settleResult, null, 2));

    if (!settleResult.isValid) {
      console.log("Payment invalid details:", settleResult);
      console.log("=== X402 DEBUG END (INVALID) ===");
      return c.json({ error: "Payment invalid or unconfirmed", details: settleResult }, 402);
    }

    console.log("=== X402 DEBUG END (SUCCESS) ===");

    // Add X-PAYMENT-RESPONSE header
    c.header("X-PAYMENT-RESPONSE", JSON.stringify(settleResult));

    return next();
  };
};
