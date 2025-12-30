import type { Context } from "hono";
import { X402PaymentVerifier } from "x402-stacks";
import { replaceBigintWithString } from "../utils/bigint";
import {
  getPaymentAmountForPath,
  getEndpointTier,
  TIER_AMOUNTS,
  type TokenType,
  type PricingTier,
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
  pricingTier: PricingTier;
}

export interface SettlePaymentResult {
  isValid: boolean;
  txId?: string;
  status?: string;
  blockHeight?: number;
  error?: string;
  reason?: string;
}

// Payment error codes for client debugging
export type PaymentErrorCode =
  | "FACILITATOR_UNAVAILABLE"  // 503 - facilitator is down
  | "FACILITATOR_ERROR"        // 502 - facilitator returned error
  | "PAYMENT_INVALID"          // 400 - bad signature, wrong recipient, etc.
  | "INSUFFICIENT_FUNDS"       // 402 - wallet needs funding
  | "PAYMENT_EXPIRED"          // 402 - nonce expired, sign fresh payment
  | "AMOUNT_TOO_LOW"           // 402 - payment amount below minimum
  | "NETWORK_ERROR"            // 502 - transient network issue
  | "UNKNOWN_ERROR";           // 500 - unexpected error

export interface PaymentErrorResponse {
  error: string;
  code: PaymentErrorCode;
  retryAfter?: number;  // seconds until retry is recommended
  tokenType: TokenType;
  resource: string;
  details?: {           // Raw error details for debugging
    settleError?: string;
    settleReason?: string;
    settleStatus?: string;
    exceptionMessage?: string;
  };
}

// Helper to classify errors from facilitator
function classifyPaymentError(error: unknown, settleResult?: SettlePaymentResult): {
  code: PaymentErrorCode;
  message: string;
  httpStatus: number;
  retryAfter?: number;
} {
  const errorStr = String(error).toLowerCase();
  const resultError = settleResult?.error?.toLowerCase() || "";
  const resultReason = settleResult?.reason?.toLowerCase() || "";
  const combined = `${errorStr} ${resultError} ${resultReason}`;

  // Network/connection errors - transient, retry soon
  if (
    combined.includes("fetch") ||
    combined.includes("network") ||
    combined.includes("econnrefused") ||
    combined.includes("timeout") ||
    combined.includes("enotfound")
  ) {
    return {
      code: "NETWORK_ERROR",
      message: "Network error communicating with payment facilitator",
      httpStatus: 502,
      retryAfter: 5,
    };
  }

  // Facilitator unavailable - retry later
  if (
    combined.includes("503") ||
    combined.includes("service unavailable") ||
    combined.includes("facilitator") && combined.includes("unavailable")
  ) {
    return {
      code: "FACILITATOR_UNAVAILABLE",
      message: "Payment facilitator temporarily unavailable",
      httpStatus: 503,
      retryAfter: 30,
    };
  }

  // Insufficient funds - client needs to fund wallet
  if (
    combined.includes("insufficient") ||
    combined.includes("balance") ||
    combined.includes("not enough")
  ) {
    return {
      code: "INSUFFICIENT_FUNDS",
      message: "Insufficient funds in wallet",
      httpStatus: 402,
    };
  }

  // Payment expired - sign a new payment
  if (
    combined.includes("expired") ||
    combined.includes("nonce") ||
    combined.includes("stale")
  ) {
    return {
      code: "PAYMENT_EXPIRED",
      message: "Payment expired, please sign a new payment",
      httpStatus: 402,
    };
  }

  // Amount too low
  if (
    combined.includes("amount") &&
    (combined.includes("low") || combined.includes("minimum") || combined.includes("less"))
  ) {
    return {
      code: "AMOUNT_TOO_LOW",
      message: "Payment amount below minimum required",
      httpStatus: 402,
    };
  }

  // Invalid payment - client error
  if (
    combined.includes("invalid") ||
    combined.includes("signature") ||
    combined.includes("recipient") ||
    combined.includes("malformed")
  ) {
    return {
      code: "PAYMENT_INVALID",
      message: "Invalid payment: " + (resultReason || resultError || "check signature and parameters"),
      httpStatus: 400,
    };
  }

  // Facilitator returned an error response
  if (combined.includes("500") || combined.includes("502") || combined.includes("error")) {
    return {
      code: "FACILITATOR_ERROR",
      message: "Payment facilitator error",
      httpStatus: 502,
      retryAfter: 10,
    };
  }

  // Unknown error - log and return generic
  return {
    code: "UNKNOWN_ERROR",
    message: "Payment processing error",
    httpStatus: 500,
    retryAfter: 5,
  };
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
      // Use path-based pricing for tiered amounts
      minAmount = getPaymentAmountForPath(c.req.path, tokenType);
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

    const pricingTier = getEndpointTier(c.req.path);

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
        pricingTier,
      };

      return c.json(paymentRequest, 402);
    }

    // Verify/settle payment
    let settleResult: SettlePaymentResult;
    console.log("settlePayment starting:", {
      facilitatorUrl: config.facilitatorUrl,
      expectedRecipient: config.address,
      minAmount: config.minAmount.toString(),
      tokenType,
      signedTxLength: signedTx.length,
    });
    try {
      settleResult = (await verifier.settlePayment(signedTx, {
        expectedRecipient: config.address,
        minAmount: config.minAmount,
        tokenType,
      })) as SettlePaymentResult;
      console.log("settlePayment result:", JSON.stringify(settleResult));
    } catch (error) {
      console.error("settlePayment exception:", error, "Type:", typeof error, "Message:", (error as Error)?.message);

      // Classify the error and return appropriate response
      const classified = classifyPaymentError(error);

      const errorResponse: PaymentErrorResponse = {
        error: classified.message,
        code: classified.code,
        retryAfter: classified.retryAfter,
        tokenType,
        resource: c.req.path,
        details: {
          exceptionMessage: String(error),
        },
      };

      // Set Retry-After header for transient errors
      if (classified.retryAfter) {
        c.header("Retry-After", String(classified.retryAfter));
      }

      return c.json(errorResponse, classified.httpStatus as 400 | 402 | 500 | 502 | 503);
    }

    if (!settleResult.isValid) {
      console.error("Payment invalid/unconfirmed:", settleResult);

      // Classify based on the settle result
      const classified = classifyPaymentError(
        settleResult.error || settleResult.status || "invalid",
        settleResult
      );

      const errorResponse: PaymentErrorResponse = {
        error: classified.message,
        code: classified.code,
        retryAfter: classified.retryAfter,
        tokenType,
        resource: c.req.path,
        details: {
          settleError: settleResult.error,
          settleReason: settleResult.reason,
          settleStatus: settleResult.status,
        },
      };

      // Set Retry-After header for transient errors
      if (classified.retryAfter) {
        c.header("Retry-After", String(classified.retryAfter));
      }

      return c.json(errorResponse, classified.httpStatus as 400 | 402 | 500 | 502 | 503);
    }

    // Add X-PAYMENT-RESPONSE header
    c.header(
      "X-PAYMENT-RESPONSE",
      JSON.stringify(settleResult, replaceBigintWithString)
    );

    return next();
  };
};
