import type { X402ProbeData } from "./registry";

export interface ProbeResult {
  success: boolean;
  isX402Endpoint: boolean;
  data?: X402ProbeData;
  error?: string;
}

// Parse X402 payment requirements from 402 response
function parsePaymentRequirements(body: unknown): {
  paymentAddress: string;
  acceptedTokens: string[];
  prices: Record<string, string>;
} | null {
  // x402 typically returns payment requirements in the response body
  // Format varies but usually includes accepts array with token info
  if (!body || typeof body !== "object") return null;

  const b = body as Record<string, unknown>;

  // Look for accepts array (x402 standard format)
  if (Array.isArray(b.accepts)) {
    const acceptedTokens: string[] = [];
    const prices: Record<string, string> = {};
    let paymentAddress = "";

    for (const accept of b.accepts) {
      if (typeof accept === "object" && accept !== null) {
        const a = accept as Record<string, unknown>;

        // Get token type
        if (typeof a.scheme === "string" || typeof a.token === "string") {
          const token = (a.scheme as string) || (a.token as string) || "unknown";
          acceptedTokens.push(token);

          // Get price/amount
          if (a.maxAmountRequired !== undefined) {
            prices[token] = String(a.maxAmountRequired);
          } else if (a.amount !== undefined) {
            prices[token] = String(a.amount);
          }

          // Get payment address
          if (typeof a.payTo === "string" && !paymentAddress) {
            paymentAddress = a.payTo;
          } else if (typeof a.address === "string" && !paymentAddress) {
            paymentAddress = a.address;
          }
        }
      }
    }

    if (acceptedTokens.length > 0) {
      return { paymentAddress, acceptedTokens, prices };
    }
  }

  // Fallback: look for direct properties
  if (b.paymentAddress || b.payTo || b.address) {
    return {
      paymentAddress: String(b.paymentAddress || b.payTo || b.address || ""),
      acceptedTokens: Array.isArray(b.tokens) ? b.tokens.map(String) : ["unknown"],
      prices: typeof b.price === "object" ? (b.price as Record<string, string>) : {},
    };
  }

  return null;
}

// Probe an X402 endpoint to get payment requirements and metadata
export async function probeX402Endpoint(
  url: string,
  options?: { timeout?: number }
): Promise<ProbeResult> {
  const timeout = options?.timeout || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = Date.now();

  try {
    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { success: false, isX402Endpoint: false, error: "Invalid URL format" };
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { success: false, isX402Endpoint: false, error: "URL must use http or https" };
    }

    // First, try a request without payment to get 402 response
    const response = await fetch(url, {
      method: "POST", // Most x402 endpoints use POST
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // Empty body for probe
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    // Check if it's an x402 endpoint (returns 402)
    if (response.status !== 402) {
      // Try GET method as well
      const getResponse = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (getResponse.status === 402) {
        // Parse the GET response instead
        let body: unknown;
        try {
          body = await getResponse.json();
        } catch {
          return {
            success: true,
            isX402Endpoint: true,
            data: {
              paymentAddress: "",
              acceptedTokens: [],
              prices: {},
              responseTimeMs,
              supportedMethods: ["GET"],
              probeTimestamp: new Date().toISOString(),
            },
          };
        }

        const paymentInfo = parsePaymentRequirements(body);
        return {
          success: true,
          isX402Endpoint: true,
          data: {
            paymentAddress: paymentInfo?.paymentAddress || "",
            acceptedTokens: paymentInfo?.acceptedTokens || [],
            prices: paymentInfo?.prices || {},
            responseTimeMs,
            supportedMethods: ["GET"],
            openApiSchema: typeof body === "object" ? (body as Record<string, unknown>) : undefined,
            probeTimestamp: new Date().toISOString(),
          },
        };
      }

      // Not a 402 endpoint
      return {
        success: true,
        isX402Endpoint: false,
        error: `Endpoint returned ${response.status}, expected 402 for x402 endpoint`,
      };
    }

    // Parse the 402 response body
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Even without parseable body, it's still an x402 endpoint
      return {
        success: true,
        isX402Endpoint: true,
        data: {
          paymentAddress: "",
          acceptedTokens: [],
          prices: {},
          responseTimeMs,
          supportedMethods: ["POST"],
          probeTimestamp: new Date().toISOString(),
        },
      };
    }

    const paymentInfo = parsePaymentRequirements(body);

    // Check for OpenAPI schema in response
    let openApiSchema: Record<string, unknown> | undefined;
    if (typeof body === "object" && body !== null) {
      const b = body as Record<string, unknown>;
      if (b.schema || b.openapi || b.swagger) {
        openApiSchema = b as Record<string, unknown>;
      }
    }

    // Determine supported methods
    const supportedMethods = ["POST"]; // We know POST works
    // Try OPTIONS to discover other methods
    try {
      const optionsRes = await fetch(url, {
        method: "OPTIONS",
        signal: controller.signal,
      });
      const allowHeader = optionsRes.headers.get("Allow");
      if (allowHeader) {
        const methods = allowHeader.split(",").map((m) => m.trim().toUpperCase());
        supportedMethods.length = 0;
        supportedMethods.push(...methods);
      }
    } catch {
      // Ignore OPTIONS failures
    }

    return {
      success: true,
      isX402Endpoint: true,
      data: {
        paymentAddress: paymentInfo?.paymentAddress || "",
        acceptedTokens: paymentInfo?.acceptedTokens || [],
        prices: paymentInfo?.prices || {},
        responseTimeMs,
        supportedMethods,
        openApiSchema,
        probeTimestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { success: false, isX402Endpoint: false, error: "Request timed out" };
      }
      return { success: false, isX402Endpoint: false, error: error.message };
    }

    return { success: false, isX402Endpoint: false, error: "Unknown error occurred" };
  }
}
