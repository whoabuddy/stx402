import type { X402ProbeData } from "./registry";

// Check if hostname is private/internal (SSRF protection)
function isPrivateHostname(hostname: string): string | null {
  const lower = hostname.toLowerCase();

  // Block localhost variants
  if (lower === "localhost" || lower.endsWith(".localhost")) {
    return "Cannot probe localhost";
  }

  // Block common internal hostnames
  if (lower.endsWith(".local") || lower.endsWith(".internal") || lower.endsWith(".corp")) {
    return "Cannot probe internal hostnames";
  }

  // Check if it's an IP address
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    const [a, b] = octets;

    // Loopback: 127.0.0.0/8
    if (a === 127) return "Cannot probe loopback addresses";

    // Private Class A: 10.0.0.0/8
    if (a === 10) return "Cannot probe private IP ranges";

    // Private Class B: 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
    if (a === 172 && b >= 16 && b <= 31) return "Cannot probe private IP ranges";

    // Private Class C: 192.168.0.0/16
    if (a === 192 && b === 168) return "Cannot probe private IP ranges";

    // Link-local: 169.254.0.0/16
    if (a === 169 && b === 254) return "Cannot probe link-local addresses";

    // Current network: 0.0.0.0/8
    if (a === 0) return "Cannot probe reserved addresses";
  }

  // Block IPv6 private ranges (URL.hostname strips brackets, so [::1] becomes ::1)
  if (hostname.includes(":")) {
    // Loopback
    if (lower === "::1") return "Cannot probe loopback addresses";
    // IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1)
    if (lower.startsWith("::ffff:")) return "Cannot probe IPv4-mapped IPv6 addresses";
    // Link-local (fe80::/10)
    if (lower.startsWith("fe80:")) return "Cannot probe link-local addresses";
    // Unique local (fc00::/7)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return "Cannot probe private IP ranges";
  }

  return null; // Hostname is allowed
}

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

    // Block private/internal hostnames and IPs (SSRF protection)
    const privateIpError = isPrivateHostname(parsedUrl.hostname);
    if (privateIpError) {
      return { success: false, isX402Endpoint: false, error: privateIpError };
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
