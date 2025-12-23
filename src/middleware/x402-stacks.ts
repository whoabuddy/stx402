import type { Context } from "hono";
import { X402PaymentVerifier } from "x402-stacks";
import { replaceBigintWithString } from "../utils/bigint";
import {
  getPaymentAmount,
  type TokenType,
  validateTokenType,
} from "../utils/pricing";

export interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
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
    const queryTokenType = c.req.query("tokenType") ?? "STX";
    const headerTokenType = c.req.header("X-PAYMENT-TOKEN-TYPE") ?? "";
    const tokenTypeStr = headerTokenType || queryTokenType;

    let tokenType: TokenType;
    let minAmount: bigint;
    try {
      tokenType = validateTokenType(tokenTypeStr);
      minAmount = getPaymentAmount(tokenType);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }

    const config = {
      minAmount,
      address: c.env.X402_SERVER_ADDRESS,
      network: c.env.X402_NETWORK as "mainnet" | "testnet",
      facilitatorUrl: c.env.X402_FACILITATOR_URL,
    };

    const verifier = new X402PaymentVerifier(
      config.facilitatorUrl,
      config.network
    );
    const signedTx = c.req.header("X-PAYMENT");

    if (!signedTx) {
      // Respond 402 with payment request
      const paymentRequest: X402PaymentRequired = {
        maxAmountRequired: config.minAmount.toString(),
        resource: c.req.path,
        payTo: config.address,
        network: config.network,
        nonce: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        tokenType,
      };

      return c.json(paymentRequest, 402);
    }

    // Verify/settle payment
    let settleResult: SettlePaymentResult;
    try {
      settleResult = (await verifier.settlePayment(signedTx, {
        expectedRecipient: config.address,
        minAmount: config.minAmount,
        tokenType,
      })) as SettlePaymentResult;
    } catch (error) {
      console.error("settlePayment error:", error);
      // Graceful: allow retry (e.g. network issue)
      const retryPaymentReq: X402PaymentRequired = {
        maxAmountRequired: config.minAmount.toString(),
        resource: c.req.path,
        payTo: config.address,
        network: config.network,
        nonce: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        tokenType,
      };
      return c.json(retryPaymentReq, 402);
    }

    if (!settleResult.isValid) {
      console.error("Payment invalid/unconfirmed:", settleResult);
      // Graceful: allow retry after funding/confirmation
      // Common cases: insufficient funds (rejected), pending, expired nonce
      const retryPaymentReq: X402PaymentRequired = {
        maxAmountRequired: config.minAmount.toString(),
        resource: c.req.path,
        payTo: config.address,
        network: config.network,
        nonce: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        tokenType,
      };
      return c.json(retryPaymentReq, 402);
    }

    // Add X-PAYMENT-RESPONSE header
    c.header(
      "X-PAYMENT-RESPONSE",
      JSON.stringify(settleResult, replaceBigintWithString)
    );

    return next();
  };
};
