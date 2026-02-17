import type { Context } from "hono";
import {
  X402PaymentVerifier,
  X402_HEADERS,
  X402_ERROR_CODES,
  STACKS_NETWORKS,
} from "x402-stacks";
import type {
  PaymentRequiredV2,
  PaymentRequirementsV2,
  PaymentPayloadV2,
  SettlementResponseV2,
  NetworkV2,
} from "x402-stacks";
import type { TokenContract } from "x402-stacks";
import {
  getPaymentAmountForPath,
  getEndpointTier,
  isFreeEndpoint,
  type TokenType,
  type PricingTier,
  validateTokenType,
} from "../utils/pricing";
import type { AppVariables } from "../types";
import { getEndpointMetadata, buildBazaarExtension } from "../bazaar";

// Correct mainnet token contracts (x402-stacks has outdated sBTC address)
const TOKEN_CONTRACTS: Record<"mainnet" | "testnet", Record<"sBTC" | "USDCx", TokenContract>> = {
  mainnet: {
    sBTC: { address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", name: "sbtc-token" },
    USDCx: { address: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE", name: "usdcx" },
  },
  testnet: {
    sBTC: { address: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT", name: "sbtc-token" },
    USDCx: { address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", name: "usdcx" },
  },
};

// Map legacy network names to CAIP-2 format
const CAIP2_NETWORK: Record<"mainnet" | "testnet", NetworkV2> = {
  mainnet: STACKS_NETWORKS.MAINNET, // "stacks:1"
  testnet: STACKS_NETWORKS.TESTNET, // "stacks:2147483648"
};

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
    errorReason?: string;
    exceptionMessage?: string;
  };
}

/**
 * Build a structured payment error response with optional retry headers.
 *
 * @param classified - Classified error details (code, message, status, retryAfter)
 * @param tokenType - Token type for the payment
 * @param resource - Resource path that was accessed
 * @param details - Raw error details for debugging
 * @returns Error response object and optional Retry-After header value
 */
function buildPaymentErrorResponse(
  classified: { code: PaymentErrorCode; message: string; httpStatus: number; retryAfter?: number },
  tokenType: TokenType,
  resource: string,
  details: { errorReason?: string; exceptionMessage?: string }
): { response: PaymentErrorResponse; retryAfterHeader?: string } {
  const errorResponse: PaymentErrorResponse = {
    error: classified.message,
    code: classified.code,
    retryAfter: classified.retryAfter,
    tokenType,
    resource,
    details,
  };

  return {
    response: errorResponse,
    retryAfterHeader: classified.retryAfter ? String(classified.retryAfter) : undefined,
  };
}

/**
 * Classify payment errors from facilitator into structured error codes.
 *
 * Uses order-dependent pattern matching - more specific patterns first:
 * 1. Network/connection errors (fetch, timeout) - transient, retry soon
 * 2. Facilitator unavailable (503, service unavailable)
 * 3. V2 error codes (insufficient funds, expired, amount too low)
 * 4. Invalid payment (signature, recipient mismatch)
 * 5. Broadcast/transaction failures
 * 6. Generic facilitator errors (500, 502)
 * 7. Unknown error (fallback)
 *
 * @param errorReason - Error message from facilitator or exception
 * @returns Classified error with code, message, HTTP status, and optional retry delay
 */
function classifyPaymentError(errorReason?: string): {
  code: PaymentErrorCode;
  message: string;
  httpStatus: number;
  retryAfter?: number;
} {
  const errorStr = (errorReason || "").toLowerCase();

  // Network/connection errors - transient, retry soon
  if (
    errorStr.includes("fetch") ||
    errorStr.includes("network") ||
    errorStr.includes("econnrefused") ||
    errorStr.includes("timeout") ||
    errorStr.includes("enotfound")
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
    errorStr.includes("503") ||
    errorStr.includes("service unavailable") ||
    errorStr.includes("facilitator") && errorStr.includes("unavailable")
  ) {
    return {
      code: "FACILITATOR_UNAVAILABLE",
      message: "Payment facilitator temporarily unavailable",
      httpStatus: 503,
      retryAfter: 30,
    };
  }

  // V2 error codes from X402_ERROR_CODES
  if (
    errorStr.includes(X402_ERROR_CODES.INSUFFICIENT_FUNDS) ||
    errorStr.includes("insufficient") ||
    errorStr.includes("balance") ||
    errorStr.includes("not enough")
  ) {
    return {
      code: "INSUFFICIENT_FUNDS",
      message: "Insufficient funds in wallet",
      httpStatus: 402,
    };
  }

  // Payment expired
  if (
    errorStr.includes(X402_ERROR_CODES.INVALID_TRANSACTION_STATE) ||
    errorStr.includes("expired") ||
    errorStr.includes("nonce") ||
    errorStr.includes("stale")
  ) {
    return {
      code: "PAYMENT_EXPIRED",
      message: "Payment expired, please sign a new payment",
      httpStatus: 402,
    };
  }

  // Amount too low
  if (
    errorStr.includes(X402_ERROR_CODES.AMOUNT_INSUFFICIENT) ||
    (errorStr.includes("amount") &&
      (errorStr.includes("low") || errorStr.includes("minimum") || errorStr.includes("less")))
  ) {
    return {
      code: "AMOUNT_TOO_LOW",
      message: "Payment amount below minimum required",
      httpStatus: 402,
    };
  }

  // Invalid payment - client error
  if (
    errorStr.includes(X402_ERROR_CODES.INVALID_PAYLOAD) ||
    errorStr.includes(X402_ERROR_CODES.RECIPIENT_MISMATCH) ||
    errorStr.includes(X402_ERROR_CODES.SENDER_MISMATCH) ||
    errorStr.includes(X402_ERROR_CODES.INVALID_SCHEME) ||
    errorStr.includes(X402_ERROR_CODES.INVALID_X402_VERSION) ||
    errorStr.includes("invalid") ||
    errorStr.includes("signature") ||
    errorStr.includes("recipient") ||
    errorStr.includes("malformed")
  ) {
    return {
      code: "PAYMENT_INVALID",
      message: "Invalid payment: " + (errorReason || "check signature and parameters"),
      httpStatus: 400,
    };
  }

  // Broadcast/transaction failures
  if (
    errorStr.includes(X402_ERROR_CODES.BROADCAST_FAILED) ||
    errorStr.includes(X402_ERROR_CODES.TRANSACTION_FAILED) ||
    errorStr.includes(X402_ERROR_CODES.TRANSACTION_NOT_FOUND)
  ) {
    return {
      code: "FACILITATOR_ERROR",
      message: "Transaction broadcast failed: " + (errorReason || "try again"),
      httpStatus: 502,
      retryAfter: 10,
    };
  }

  // Facilitator returned an error response
  if (
    errorStr.includes("500") ||
    errorStr.includes("502") ||
    errorStr.includes(X402_ERROR_CODES.UNEXPECTED_SETTLE_ERROR) ||
    errorStr.includes(X402_ERROR_CODES.UNEXPECTED_VERIFY_ERROR) ||
    errorStr.includes("error")
  ) {
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
    c: Context<{ Bindings: Env; Variables: AppVariables }>,
    next: () => Promise<Response | void>
  ) => {
    // Skip payment for free endpoints (safety check - these shouldn't have middleware applied)
    if (isFreeEndpoint(c.req.path)) {
      return next();
    }

    // Determine token type from header or query
    // V2: token type is embedded in payload, but we still accept query param for 402 response
    const queryTokenType = c.req.query("tokenType") ?? "STX";

    let tokenType: TokenType;
    let minAmount: bigint;
    try {
      tokenType = validateTokenType(queryTokenType);
      // Use path-based pricing for tiered amounts
      minAmount = getPaymentAmountForPath(c.req.path, tokenType);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }

    const legacyNetwork = c.env.X402_NETWORK as "mainnet" | "testnet";
    const config = {
      minAmount,
      address: c.env.X402_SERVER_ADDRESS,
      network: CAIP2_NETWORK[legacyNetwork],
      legacyNetwork,
      facilitatorUrl: c.env.X402_FACILITATOR_URL,
    };

    const pricingTier = getEndpointTier(c.req.path);

    // Read V2 payment header (base64 encoded JSON)
    const signedPayloadHeader = c.req.header(X402_HEADERS.PAYMENT_SIGNATURE);

    if (!signedPayloadHeader) {
      // Build asset identifier
      let asset = "STX";
      if (tokenType === "sBTC" || tokenType === "USDCx") {
        const contract = TOKEN_CONTRACTS[config.legacyNetwork][tokenType];
        asset = `${contract.address}.${contract.name}`;
      }

      // Build V2 payment required response
      const paymentRequired: PaymentRequiredV2 = {
        x402Version: 2,
        resource: {
          url: c.req.url,
          description: `Access to ${c.req.path}`,
        },
        accepts: [{
          scheme: "exact",
          network: config.network,
          amount: config.minAmount.toString(),
          asset,
          payTo: config.address,
          maxTimeoutSeconds: 300, // 5 minutes
          extra: {
            nonce: crypto.randomUUID(),
            pricingTier,
            tokenType,
            ...(tokenType !== "STX" && {
              tokenContract: TOKEN_CONTRACTS[config.legacyNetwork][tokenType as "sBTC" | "USDCx"],
            }),
          },
        }],
      };

      // Add Bazaar discovery extension if metadata exists for this endpoint
      const endpointMetadata = getEndpointMetadata(c.req.path, c.req.method);
      if (endpointMetadata) {
        paymentRequired.extensions = {
          bazaar: buildBazaarExtension(endpointMetadata).bazaar,
        };
      }

      // Set V2 header (base64 encoded) and return JSON body
      c.header(X402_HEADERS.PAYMENT_REQUIRED, btoa(JSON.stringify(paymentRequired)));
      return c.json(paymentRequired, 402);
    }

    // Decode and parse payment payload
    let paymentPayload: PaymentPayloadV2;
    try {
      const decoded = atob(signedPayloadHeader);
      paymentPayload = JSON.parse(decoded);

      if (paymentPayload.x402Version !== 2) {
        return c.json({ error: "Invalid x402 version, expected 2" }, 400);
      }
    } catch {
      return c.json({ error: "Invalid payment payload encoding" }, 400);
    }

    // Build payment requirements for verification
    const acceptedRequirements = paymentPayload.accepted;

    // Validate payment requirements match our expectations
    if (acceptedRequirements.network !== config.network) {
      return c.json({
        error: `Network mismatch: expected ${config.network}, got ${acceptedRequirements.network}`,
      }, 400);
    }

    if (acceptedRequirements.payTo !== config.address) {
      return c.json({
        error: `Recipient mismatch: expected ${config.address}, got ${acceptedRequirements.payTo}`,
      }, 400);
    }

    if (BigInt(acceptedRequirements.amount) < config.minAmount) {
      return c.json({
        error: `Amount too low: minimum ${config.minAmount}, got ${acceptedRequirements.amount}`,
      }, 402);
    }

    // Use V2 verifier
    const verifier = new X402PaymentVerifier(config.facilitatorUrl);

    // Settle payment
    let settleResult: SettlementResponseV2;
    const paymentLog = c.var.logger.child({ tokenType });
    paymentLog.debug("settlePayment starting (V2)", {
      facilitatorUrl: config.facilitatorUrl,
      expectedRecipient: config.address,
      minAmount: config.minAmount.toString(),
      network: config.network,
    });

    try {
      settleResult = await verifier.settle(paymentPayload, {
        paymentRequirements: acceptedRequirements,
      });
      paymentLog.debug("settlePayment result (V2)", settleResult);
    } catch (error) {
      paymentLog.error("settlePayment exception (V2)", { error: String(error), type: typeof error });

      // Classify the error and return appropriate response
      const classified = classifyPaymentError(String(error));
      const { response, retryAfterHeader } = buildPaymentErrorResponse(
        classified,
        tokenType,
        c.req.path,
        { exceptionMessage: String(error) }
      );

      // Set Retry-After header for transient errors
      if (retryAfterHeader) {
        c.header("Retry-After", retryAfterHeader);
      }

      return c.json(response, classified.httpStatus as 400 | 402 | 500 | 502 | 503);
    }

    if (!settleResult.success) {
      paymentLog.error("Payment settlement failed (V2)", settleResult);

      // Classify based on the settle result
      const classified = classifyPaymentError(settleResult.errorReason);
      const { response, retryAfterHeader } = buildPaymentErrorResponse(
        classified,
        tokenType,
        c.req.path,
        { errorReason: settleResult.errorReason }
      );

      // Set Retry-After header for transient errors
      if (retryAfterHeader) {
        c.header("Retry-After", retryAfterHeader);
      }

      return c.json(response, classified.httpStatus as 400 | 402 | 500 | 502 | 503);
    }

    // Set V2 response header (base64 encoded)
    c.header(X402_HEADERS.PAYMENT_RESPONSE, btoa(JSON.stringify(settleResult)));

    // Log successful payment
    paymentLog.info("Payment verified (V2)", {
      txId: settleResult.transaction,
      payer: settleResult.payer,
      amount: config.minAmount.toString(),
      resource: c.req.path,
      network: settleResult.network,
    });

    // Store settle result and payment payload in context for endpoint access
    c.set("settleResult", settleResult);
    c.set("paymentPayload", paymentPayload);

    return next();
  };
};
