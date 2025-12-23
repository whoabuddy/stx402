import type { Context } from "hono";
import { X402PaymentVerifier, STXtoMicroSTX } from "x402-stacks";
import { replaceBigintWithString } from "../utils/bigint";

export interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: "STX" | "sBTC" | "USDCX";
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
    let tokenType: "STX" | "sBTC" | "USDCX" = (c.req.query("tokenType") as any) || "STX";
    const headerTokenType = c.req.header("X-PAYMENT-TOKEN-TYPE") as string | null;
    if (headerTokenType && (headerTokenType === "STX" || headerTokenType === "sBTC" || headerTokenType === "USDCX")) {
      tokenType = headerTokenType as "STX" | "sBTC" | "USDCX";
    }

    const amounts: Record<"STX" | "sBTC" | "USDCX", string> = {
      STX: c.env.X402_PAYMENT_AMOUNT_STX!,
      sBTC: c.env.X402_PAYMENT_AMOUNT_SBTC!,
      USDCX: c.env.X402_PAYMENT_AMOUNT_USDCX || "0",
    };
    const amountStr = amounts[tokenType];
    if (!amountStr || parseFloat(amountStr) === 0) {
      return c.json({ error: `Unsupported or zero amount for tokenType: ${tokenType}` }, 400);
    }

    // Token-specific unit conversion to smallest units (microSTX/sats/microUSDC)
    let minAmount: bigint;
    const amountNum = parseFloat(amountStr);
    switch (tokenType) {
      case "STX":
        minAmount = STXtoMicroSTX(amountStr);
        break;
      case "sBTC":
        minAmount = BigInt(Math.floor(amountNum * 1e8)); // BTC to sats
        break;
      case "USDCX":
        minAmount = BigInt(Math.floor(amountNum * 1e6)); // USD to micro-USD
        break;
      default:
        throw new Error(`Unknown tokenType: ${tokenType}`);
    }

    const config = {
      amountStr,
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
      return c.json({ error: "Payment settlement failed", details: String(error) }, 402);
    }


    if (!settleResult.isValid) {
      return c.json({ error: "Payment invalid or unconfirmed", details: settleResult }, 402);
    }

    // Add X-PAYMENT-RESPONSE header
    c.header("X-PAYMENT-RESPONSE", JSON.stringify(settleResult, replaceBigintWithString));

    return next();
  };
};
