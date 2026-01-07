import { BaseEndpoint } from "../BaseEndpoint";
import { log } from "../../utils/logger";
import type { AppContext } from "../../types";
import { validateValueSize, validateTtl, KV_LIMITS } from "../../utils/namespace";

// Paste-specific limits
const PASTE_LIMITS = {
  MAX_CONTENT_BYTES: 500 * 1024, // 500KB max for paste
  CODE_LENGTH: 6,
  DEFAULT_TTL: 7 * 24 * 60 * 60, // 7 days
  MAX_TTL: 30 * 24 * 60 * 60, // 30 days
};

// Characters for short code generation (alphanumeric, no confusing chars)
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // No i, l, o, 0, 1

function generateShortCode(): string {
  const array = new Uint8Array(PASTE_LIMITS.CODE_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => CODE_CHARS[b % CODE_CHARS.length])
    .join("");
}

interface PasteMetadata {
  createdAt: string;
  createdBy: string;
  language?: string;
  bytes: number;
}

export class PasteCreate extends BaseEndpoint {
  schema = {
    tags: ["Paste"],
    summary: "(paid) Create a paste and get a short code",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["content"],
            properties: {
              content: {
                type: "string" as const,
                description: `Text content to store (max ${PASTE_LIMITS.MAX_CONTENT_BYTES / 1024}KB)`,
              },
              language: {
                type: "string" as const,
                description: "Language hint for syntax highlighting (e.g., javascript, python, markdown)",
              },
              ttl: {
                type: "number" as const,
                description: `TTL in seconds (min ${KV_LIMITS.TTL_MIN_SECONDS}, max ${PASTE_LIMITS.MAX_TTL}, default ${PASTE_LIMITS.DEFAULT_TTL} = 7 days)`,
                minimum: KV_LIMITS.TTL_MIN_SECONDS,
                maximum: PASTE_LIMITS.MAX_TTL,
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "Paste created successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                code: { type: "string" as const, description: "Short code for retrieval" },
                url: { type: "string" as const, description: "Full URL to paste" },
                expiresAt: { type: "string" as const },
                bytes: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid request",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: {
      content: string;
      language?: string;
      ttl?: number;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { content, language, ttl } = body;

    // Validate content
    if (!content || typeof content !== "string") {
      return this.errorResponse(c, "Content is required and must be a string", 400);
    }

    // Validate content size
    const sizeValidation = validateValueSize(content, false);
    if (!sizeValidation.valid) {
      return this.errorResponse(c, sizeValidation.error!, 400);
    }

    if (sizeValidation.bytes > PASTE_LIMITS.MAX_CONTENT_BYTES) {
      return this.errorResponse(
        c,
        `Content exceeds maximum size of ${PASTE_LIMITS.MAX_CONTENT_BYTES / 1024}KB`,
        400
      );
    }

    // Validate TTL
    const ttlValidation = validateTtl(ttl);
    if (!ttlValidation.valid) {
      return this.errorResponse(c, ttlValidation.error!, 400);
    }

    let effectiveTtl = ttl ?? PASTE_LIMITS.DEFAULT_TTL;
    if (effectiveTtl > PASTE_LIMITS.MAX_TTL) {
      effectiveTtl = PASTE_LIMITS.MAX_TTL;
    }

    // Generate unique short code (retry if collision)
    let code: string;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      code = generateShortCode();
      const existing = await c.env.STORAGE.get(`paste:${code}`);
      if (existing === null) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return this.errorResponse(c, "Failed to generate unique code, please try again", 500);
    }

    // Store paste
    const metadata: PasteMetadata = {
      createdAt: new Date().toISOString(),
      createdBy: payerAddress,
      language: language || undefined,
      bytes: sizeValidation.bytes,
    };

    const expiresAt = new Date(Date.now() + effectiveTtl * 1000).toISOString();

    try {
      await c.env.STORAGE.put(`paste:${code}`, content, {
        expirationTtl: effectiveTtl,
        metadata,
      });
    } catch (error) {
      log.error("Paste create error", { error: String(error) });
      return this.errorResponse(c, "Failed to create paste", 500);
    }

    // Build URL (use request host if available)
    const host = c.req.header("host") || "stx402.com";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/api/paste/${code}`;

    return c.json({
      code,
      url,
      expiresAt,
      bytes: sizeValidation.bytes,
      language: language || null,
      tokenType,
    });
  }
}
