/**
 * Test Generator for X402 V2 Endpoints
 *
 * Creates standardized test functions for paid endpoints that follow the
 * X402 V2 payment flow: initial 402 → sign payment → retry with header → validate.
 *
 * Usage:
 * ```typescript
 * import { createEndpointTest } from "./_test_generator";
 *
 * export const testX402ManualFlow = createEndpointTest({
 *   name: "base64-encode",
 *   endpoint: "/api/text/base64-encode",
 *   method: "POST",
 *   body: { input: "Hello, World!" },
 *   validateResponse: (data, tokenType) =>
 *     data.result === "SGVsbG8sIFdvcmxkIQ==" && data.tokenType === tokenType,
 * });
 * ```
 */

import { X402PaymentClient, X402_HEADERS } from "x402-stacks";
import type { TokenType, NetworkType, PaymentRequiredV2, PaymentRequirementsV2 } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import {
  TEST_TOKENS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
  createTestLogger,
  buildPaymentPayloadV2,
  type TestLogger,
} from "./_shared_utils";

export interface TestConfig {
  /** Short name for the test (used in logs) */
  name: string;
  /** API endpoint path (e.g., "/api/text/base64-encode") */
  endpoint: string;
  /** HTTP method */
  method: "GET" | "POST";
  /** Request body for POST requests */
  body?: Record<string, unknown>;
  /** Function to validate the response data */
  validateResponse: (data: unknown, tokenType: TokenType) => boolean;
  /** Optional description for logging */
  description?: string;
  /** Custom headers to include */
  headers?: Record<string, string>;
  /** Expected content type (defaults to application/json) */
  expectedContentType?: string;
  /** Additional HTTP status codes to accept as valid (besides 200) */
  allowedStatuses?: number[];
  /** Skip payment flow for free endpoints */
  skipPayment?: boolean;
}

export interface TestResult {
  tokenResults: Record<string, boolean>;
}

/**
 * Creates a test function for an X402 V2 paid endpoint.
 * The returned function follows the standard X402 V2 payment flow.
 */
export function createEndpointTest(config: TestConfig) {
  return async function testX402ManualFlow(
    verbose = false
  ): Promise<TestResult> {
    if (!X402_CLIENT_PK) {
      throw new Error(
        "Set X402_CLIENT_PK env var with testnet private key mnemonic"
      );
    }

    const { address, key } = await deriveChildAccount(
      X402_NETWORK as NetworkType,
      X402_CLIENT_PK,
      0
    );

    const logger = createTestLogger(config.name, verbose);
    logger.info(`Test wallet address: ${address}`);
    if (config.description) {
      logger.info(`Testing: ${config.description}`);
    }

    const x402Client = new X402PaymentClient({
      network: X402_NETWORK as NetworkType,
      privateKey: key,
    });

    const tokenResults: Record<string, boolean> = TEST_TOKENS.reduce(
      (acc, t) => {
        acc[t] = false;
        return acc;
      },
      {} as Record<string, boolean>
    );

    for (const tokenType of TEST_TOKENS) {
      logger.info(`--- Testing ${tokenType} ---`);

      try {
        const success = await testSingleToken(
          config,
          tokenType,
          x402Client,
          logger
        );
        tokenResults[tokenType] = success;
      } catch (error) {
        logger.error(`Exception for ${tokenType}: ${String(error)}`);
        tokenResults[tokenType] = false;
      }
    }

    const successCount = Object.values(tokenResults).filter((v) => v).length;
    logger.summary(successCount, TEST_TOKENS.length);

    return { tokenResults };
  };
}

async function testSingleToken(
  config: TestConfig,
  tokenType: TokenType,
  x402Client: X402PaymentClient,
  logger: TestLogger
): Promise<boolean> {
  const endpoint = `${config.endpoint}?tokenType=${tokenType}`;
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;

  // Step 1: Initial request (expect 402)
  logger.info("1. Initial request (expect 402)...");

  const initialRes = await fetch(fullUrl, {
    method: config.method,
    headers: {
      ...(config.body ? { "Content-Type": "application/json" } : {}),
      ...config.headers,
    },
    body: config.body ? JSON.stringify(config.body) : undefined,
  });

  if (initialRes.status !== 402) {
    const text = await initialRes.text();
    logger.error(`Expected 402, got ${initialRes.status}: ${text}`);
    return false;
  }

  // Parse V2 payment requirements
  const paymentReq: PaymentRequiredV2 = await initialRes.json();
  logger.debug("402 Payment req (V2)", paymentReq);

  if (paymentReq.x402Version !== 2) {
    logger.error(`Expected x402Version 2, got ${paymentReq.x402Version}`);
    return false;
  }

  if (!paymentReq.accepts?.length) {
    logger.error("No payment options in accepts array");
    return false;
  }

  const requirements = paymentReq.accepts[0];

  // Check token type in extra field
  const reqTokenType = requirements.extra?.tokenType as TokenType;
  if (reqTokenType && reqTokenType !== tokenType) {
    logger.error(`Expected tokenType ${tokenType}, got ${reqTokenType}`);
    return false;
  }

  // Step 2: Sign payment
  logger.info("2. Signing payment...");

  // Build V1-compatible request for the client
  const v1Request = {
    maxAmountRequired: requirements.amount,
    resource: paymentReq.resource.url,
    payTo: requirements.payTo,
    network: X402_NETWORK as "mainnet" | "testnet",
    nonce: (requirements.extra?.nonce as string) || crypto.randomUUID(),
    expiresAt: new Date(Date.now() + requirements.maxTimeoutSeconds * 1000).toISOString(),
    tokenType: reqTokenType || tokenType,
    ...(requirements.extra?.tokenContract && { tokenContract: requirements.extra.tokenContract }),
  };

  const signResult = await x402Client.signPayment(v1Request);
  logger.debug("Signed payment", signResult);

  // Step 3: Build V2 payload and retry
  logger.info("3. Retry with payment-signature...");

  const paymentPayload = buildPaymentPayloadV2(signResult.signedTransaction, requirements);
  const encodedPayload = btoa(JSON.stringify(paymentPayload));

  const retryRes = await fetch(fullUrl, {
    method: config.method,
    headers: {
      ...(config.body ? { "Content-Type": "application/json" } : {}),
      ...config.headers,
      [X402_HEADERS.PAYMENT_SIGNATURE]: encodedPayload,
    },
    body: config.body ? JSON.stringify(config.body) : undefined,
  });

  logger.info(`Retry status: ${retryRes.status}`);

  // Check if status is acceptable (200 or in allowedStatuses)
  const acceptableStatuses = [200, ...(config.allowedStatuses || [])];
  if (!acceptableStatuses.includes(retryRes.status)) {
    const errText = await retryRes.text();
    logger.error(`Retry failed (${retryRes.status}): ${errText}`);
    return false;
  }

  // Step 4: Validate response
  const contentType = retryRes.headers.get("content-type") || "";
  const expectedContentType = config.expectedContentType || "application/json";

  if (!contentType.includes(expectedContentType.split("/")[0])) {
    logger.error(
      `Expected content-type ${expectedContentType}, got ${contentType}`
    );
    return false;
  }

  // For JSON responses, parse and validate
  if (contentType.includes("application/json")) {
    const data = await retryRes.json();
    logger.debug("Response data", data);

    if (config.validateResponse(data, tokenType)) {
      logger.success(`Passed for ${tokenType}`);
      return true;
    } else {
      logger.error(`Validation failed for ${tokenType}`);
      logger.debug("Full response", data);
      return false;
    }
  }

  // For non-JSON responses (images, audio, etc.)
  logger.success(`Passed for ${tokenType} (${contentType})`);
  return true;
}

/**
 * Validation helpers for common response patterns
 */
export const validators = {
  /** Validate that result exists and matches expected value */
  resultEquals: <T>(expected: T) => (data: unknown, tokenType: TokenType) => {
    const d = data as { result: T; tokenType: TokenType };
    return d.result === expected && d.tokenType === tokenType;
  },

  /** Validate that result is a non-empty string */
  resultIsString: (data: unknown, tokenType: TokenType) => {
    const d = data as { result: string; tokenType: TokenType };
    return (
      typeof d.result === "string" &&
      d.result.length > 0 &&
      d.tokenType === tokenType
    );
  },

  /** Validate that result is a number */
  resultIsNumber: (data: unknown, tokenType: TokenType) => {
    const d = data as { result: number; tokenType: TokenType };
    return typeof d.result === "number" && d.tokenType === tokenType;
  },

  /** Validate that result is an array */
  resultIsArray: (data: unknown, tokenType: TokenType) => {
    const d = data as { result: unknown[]; tokenType: TokenType };
    return Array.isArray(d.result) && d.tokenType === tokenType;
  },

  /** Validate that result is an object with specific keys */
  resultHasKeys:
    (keys: string[]) => (data: unknown, tokenType: TokenType) => {
      const d = data as { result: Record<string, unknown>; tokenType: TokenType };
      return (
        typeof d.result === "object" &&
        d.result !== null &&
        keys.every((k) => k in d.result) &&
        d.tokenType === tokenType
      );
    },

  /** Validate result matches a custom predicate */
  resultMatches:
    <T>(predicate: (result: T) => boolean) =>
    (data: unknown, tokenType: TokenType) => {
      const d = data as { result: T; tokenType: TokenType };
      return predicate(d.result) && d.tokenType === tokenType;
    },
};

/**
 * Create multiple tests from a configuration array
 */
export function createEndpointTests(
  configs: TestConfig[]
): Record<string, () => Promise<TestResult>> {
  const tests: Record<string, () => Promise<TestResult>> = {};

  for (const config of configs) {
    tests[config.name] = createEndpointTest(config);
  }

  return tests;
}

/**
 * Run all tests and aggregate results
 */
export async function runAllTests(
  tests: Record<string, () => Promise<TestResult>>,
  verbose = false
): Promise<{
  total: number;
  passed: number;
  failed: number;
  byToken: Record<string, { passed: number; total: number }>;
}> {
  const byToken: Record<string, { passed: number; total: number }> = {};
  for (const token of TEST_TOKENS) {
    byToken[token] = { passed: 0, total: 0 };
  }

  let totalPassed = 0;
  let totalTests = 0;

  for (const [name, testFn] of Object.entries(tests)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Running: ${name}`);
    console.log("=".repeat(60));

    try {
      const result = await testFn();

      for (const [token, passed] of Object.entries(result.tokenResults)) {
        byToken[token].total++;
        totalTests++;
        if (passed) {
          byToken[token].passed++;
          totalPassed++;
        }
      }
    } catch (error) {
      console.error(`Test ${name} crashed: ${error}`);
      for (const token of TEST_TOKENS) {
        byToken[token].total++;
        totalTests++;
      }
    }
  }

  return {
    total: totalTests,
    passed: totalPassed,
    failed: totalTests - totalPassed,
    byToken,
  };
}
