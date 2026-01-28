import { X402PaymentClient, X402_HEADERS } from "x402-stacks";
import type {
  NetworkType,
  TokenType,
  PaymentRequiredV2,
  PaymentRequirementsV2,
  PaymentPayloadV2,
  SettlementResponseV2,
} from "x402-stacks";

export const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
} as const;

export const X402_CLIENT_PK = process.env.X402_CLIENT_PK;
export const X402_NETWORK = (process.env.X402_NETWORK || "testnet") as NetworkType;

// Override with X402_WORKER_URL env var for production testing
export const X402_WORKER_URL = process.env.X402_WORKER_URL || "http://localhost:8787";

export const TEST_TOKENS: TokenType[] = ["STX", "sBTC", "USDCx"];

// =============================================================================
// Randomization Helpers
// =============================================================================

/**
 * Fisher-Yates shuffle - returns a new shuffled array
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick N random items from an array (without replacement)
 */
export function sampleArray<T>(array: T[], n: number): T[] {
  if (n >= array.length) return shuffle(array);
  return shuffle(array).slice(0, n);
}

/**
 * Pick a random item from an array
 */
export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export interface TestLogger {
  info: (msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  summary: (successCount: number, total: number) => void;
  debug: (msg: string, data?: unknown) => void;
}

export function createTestLogger(testName: string, verbose = false): TestLogger {
  return {
    info: (msg) => console.log(`${COLORS.cyan}[${testName}]${COLORS.reset} ${msg}`),
    success: (msg) => console.log(`${COLORS.bright}${COLORS.green}[${testName}] ✅ ${msg}${COLORS.reset}`),
    error: (msg) => console.log(`${COLORS.bright}${COLORS.red}[${testName}] ❌ ${msg}${COLORS.reset}`),
    debug: (msg: string, data?: unknown) => {
      if (verbose) {
        console.log(`${COLORS.gray}[${testName}] 🔍 ${msg}${data ? `: ${JSON.stringify(data, null, 2)}` : ''}${COLORS.reset}`);
      }
    },
    summary: (successCount, total) => {
      const passRate = ((successCount / total) * 100).toFixed(1);
      const color = successCount === total ? COLORS.green : COLORS.yellow;
      console.log(`${COLORS.bright}${color}[${testName}] 📊 ${successCount}/${total} passed (${passRate}%)${COLORS.reset}\n`);
    }
  };
}

// =============================================================================
// Retry Logic for Nonce Conflicts
// =============================================================================

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PaymentErrorResponse {
  error: string;
  code: string;
  retryAfter?: number;
  tokenType: TokenType;
  resource: string;
  details?: {
    errorReason?: string;
    exceptionMessage?: string;
  };
}

/**
 * Check if error is a nonce conflict (transaction with same nonce already in mempool)
 * These require waiting for the stuck tx to confirm, then re-signing with fresh nonce
 */
export function isNonceConflict(errorText: string): boolean {
  const lower = errorText.toLowerCase();
  return (
    lower.includes("conflictingnonceinmempool") ||
    lower.includes("conflicting nonce") ||
    lower.includes("nonce already used") ||
    lower.includes("nonce too low")
  );
}

/**
 * Check if error is retryable (transient network/facilitator issues)
 */
export function isRetryableError(status: number, errorCode?: string, errorMessage?: string): boolean {
  // HTTP status codes that are retryable
  if ([429, 500, 502, 503, 504].includes(status)) return true;

  // Error codes that are retryable
  const retryableCodes = ["NETWORK_ERROR", "FACILITATOR_UNAVAILABLE", "FACILITATOR_ERROR", "UNKNOWN_ERROR"];
  if (errorCode && retryableCodes.includes(errorCode)) return true;

  // Message patterns that are retryable
  if (errorMessage) {
    const lowerMsg = errorMessage.toLowerCase();
    const retryablePatterns = ["429", "rate limit", "too many requests", "timeout", "temporarily", "try again"];
    if (retryablePatterns.some(pattern => lowerMsg.includes(pattern))) return true;

    // Nonce conflicts are retryable with special handling
    if (isNonceConflict(lowerMsg)) return true;
  }

  return false;
}

export interface RetryConfig {
  maxRetries?: number;           // Max retry attempts (default: 3)
  baseDelayMs?: number;          // Base delay for exponential backoff (default: 1000)
  maxDelayMs?: number;           // Max delay cap (default: 10000)
  nonceConflictDelayMs?: number; // Extra delay for nonce conflicts (default: 30000)
  verbose?: boolean;             // Log retry attempts
}

export interface X402RequestResult {
  status: number;
  data: unknown;
  headers: Headers;
  retryCount?: number;
  wasNonceConflict?: boolean;
}

/**
 * Build a V2 payment payload from a signed transaction and requirements
 */
export function buildPaymentPayloadV2(
  signedTransaction: string,
  requirements: PaymentRequirementsV2
): PaymentPayloadV2 {
  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      transaction: signedTransaction,
    },
  };
}

/**
 * Decode a V2 payment response from header (base64 JSON)
 */
export function decodePaymentResponse(header: string | null): SettlementResponseV2 | null {
  if (!header) return null;
  try {
    return JSON.parse(atob(header));
  } catch {
    return null;
  }
}

/**
 * Make an X402 V2 request with smart retry logic for nonce conflicts
 *
 * For nonce conflicts:
 * - Wait longer (tx needs to confirm or drop from mempool)
 * - Let the retry loop fetch a new 402 response with a fresh nonce on the next attempt
 * - Automatically re-sign the payment with the fresh nonce as part of each retry
 */
export async function makeX402RequestWithRetry(
  endpoint: string,
  method: "GET" | "POST",
  x402Client: X402PaymentClient,
  tokenType: TokenType,
  options: {
    body?: unknown;
    extraHeaders?: Record<string, string>;
    baseUrl?: string;
    retry?: RetryConfig;
  } = {}
): Promise<X402RequestResult> {
  const {
    body,
    extraHeaders,
    baseUrl = X402_WORKER_URL,
    retry = {},
  } = options;

  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    nonceConflictDelayMs = 30000,
    verbose = false,
  } = retry;

  const fullUrl = `${baseUrl}${endpoint}`;
  const tokenParam = endpoint.includes("?") ? `&tokenType=${tokenType}` : `?tokenType=${tokenType}`;
  const urlWithToken = `${fullUrl}${tokenParam}`;

  const log = (msg: string) => {
    if (verbose) console.log(`  ${COLORS.gray}[retry] ${msg}${COLORS.reset}`);
  };

  let retryCount = 0;
  let wasNonceConflict = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Step 1: Get 402 payment requirements (fresh on each attempt for nonce conflicts)
    log(`Attempt ${attempt + 1}/${maxRetries + 1}: fetching payment requirements...`);

    const initialRes = await fetch(urlWithToken, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // If not 402, return as-is (success or non-payment error)
    if (initialRes.status !== 402) {
      let data: unknown;
      const text = await initialRes.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: initialRes.status, data, headers: initialRes.headers, retryCount, wasNonceConflict };
    }

    // Step 2: Parse V2 payment requirements
    const paymentReq: PaymentRequiredV2 = await initialRes.json();
    if (paymentReq.x402Version !== 2 || !paymentReq.accepts?.length) {
      return {
        status: 400,
        data: { error: "Invalid V2 payment requirements" },
        headers: initialRes.headers,
        retryCount,
        wasNonceConflict,
      };
    }

    const requirements = paymentReq.accepts[0];
    const noncePreview = (requirements.extra?.nonce as string)?.slice(0, 8) ?? "<no-nonce>";
    log(`Payment required: ${requirements.amount} ${requirements.asset}, nonce: ${noncePreview}...`);

    // Step 3: Sign payment using V1 client (converts internally)
    // Build a V1-compatible request for the client
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
    log("Payment signed");

    // Step 4: Build V2 payload and submit
    const paymentPayload = buildPaymentPayloadV2(signResult.signedTransaction, requirements);
    const encodedPayload = btoa(JSON.stringify(paymentPayload));

    const paidRes = await fetch(urlWithToken, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
        [X402_HEADERS.PAYMENT_SIGNATURE]: encodedPayload,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Success
    if (paidRes.status >= 200 && paidRes.status < 300) {
      let data: unknown;
      const text = await paidRes.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: paidRes.status, data, headers: paidRes.headers, retryCount, wasNonceConflict };
    }

    // Check if we should retry
    const errText = await paidRes.text();
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let bodyRetryAfter: number | undefined;

    try {
      const parsed = JSON.parse(errText);
      errorCode = parsed.code;
      errorMessage = parsed.error || parsed.details?.errorReason || parsed.details?.exceptionMessage;
      bodyRetryAfter = parsed.retryAfter;
    } catch { /* not JSON */ }

    const fullErrorText = `${errorCode || ""} ${errorMessage || ""} ${errText}`;

    // Check for nonce conflict specifically (needs special handling with longer delay)
    if (isNonceConflict(fullErrorText)) {
      wasNonceConflict = true;
      if (attempt < maxRetries) {
        retryCount++;
        log(`Nonce conflict detected, waiting ${nonceConflictDelayMs}ms for mempool to clear...`);
        await sleep(nonceConflictDelayMs);
        continue;
      }
    // Check for other retryable errors (use else to avoid double-counting nonce conflicts)
    } else if (isRetryableError(paidRes.status, errorCode, errorMessage || errText) && attempt < maxRetries) {
      retryCount++;
      const retryAfterSecs = paidRes.headers.get("Retry-After")
        ? parseInt(paidRes.headers.get("Retry-After")!, 10)
        : (bodyRetryAfter || 0);
      const backoffMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const delayMs = retryAfterSecs > 0 ? retryAfterSecs * 1000 : backoffMs;

      log(`Retryable error (${paidRes.status}), waiting ${delayMs}ms...`);
      await sleep(delayMs);
      continue;
    }

    // Non-retryable error or max retries exceeded
    let data: unknown;
    try {
      data = JSON.parse(errText);
    } catch {
      data = errText;
    }
    return { status: paidRes.status, data, headers: paidRes.headers, retryCount, wasNonceConflict };
  }

  // Should not reach here, but TypeScript needs a return
  throw new Error("Unexpected end of retry loop");
}
