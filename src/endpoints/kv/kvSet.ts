import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  buildStorageKey,
  validateValueSize,
  validateTtl,
  isLargeValue,
  KV_LIMITS,
  type Visibility,
} from "../../utils/namespace";

export class KvSet extends BaseEndpoint {
  schema = {
    tags: ["KV Storage"],
    summary: "(paid) Store a value with optional TTL",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["key", "value"],
            properties: {
              key: {
                type: "string" as const,
                description: `Storage key (max ${KV_LIMITS.USER_KEY_MAX_CHARS} chars, no colons)`,
                maxLength: KV_LIMITS.USER_KEY_MAX_CHARS,
              },
              value: {
                oneOf: [
                  { type: "string" as const },
                  { type: "object" as const },
                  { type: "array" as const },
                  { type: "number" as const },
                  { type: "boolean" as const },
                ],
                description: "Value to store (string or JSON, max 1MB standard / 25MB large tier)",
              },
              ttl: {
                type: "number" as const,
                description: `TTL in seconds (min ${KV_LIMITS.TTL_MIN_SECONDS}, default 86400 = 1 day)`,
                minimum: KV_LIMITS.TTL_MIN_SECONDS,
              },
              visibility: {
                type: "string" as const,
                enum: ["private", "public"],
                default: "private",
                description: "private = only you can read, public = anyone with key can read",
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
        description: "Value stored successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                key: { type: "string" as const },
                visibility: { type: "string" as const },
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
      key: string;
      value: unknown;
      ttl?: number;
      visibility?: Visibility;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { key, value, ttl, visibility = "private" } = body;

    // Validate key
    if (!key || typeof key !== "string") {
      return this.errorResponse(c, "Key is required and must be a string", 400);
    }

    if (key.length > KV_LIMITS.USER_KEY_MAX_CHARS) {
      return this.errorResponse(
        c,
        `Key exceeds maximum length of ${KV_LIMITS.USER_KEY_MAX_CHARS} characters`,
        400
      );
    }

    if (key.includes(":")) {
      return this.errorResponse(c, "Key cannot contain colon (:) character", 400);
    }

    // Validate value
    if (value === undefined || value === null) {
      return this.errorResponse(c, "Value is required", 400);
    }

    // Serialize value
    const serializedValue = typeof value === "string" ? value : JSON.stringify(value);

    // Check if this is a large value (affects pricing, but we don't enforce here - middleware handles it)
    const isLarge = isLargeValue(serializedValue);

    // Validate value size
    const sizeValidation = validateValueSize(serializedValue, isLarge);
    if (!sizeValidation.valid) {
      return this.errorResponse(c, sizeValidation.error!, 400);
    }

    // Validate TTL
    const ttlValidation = validateTtl(ttl);
    if (!ttlValidation.valid) {
      return this.errorResponse(c, ttlValidation.error!, 400);
    }

    // Validate visibility
    if (visibility !== "private" && visibility !== "public") {
      return this.errorResponse(c, "Visibility must be 'private' or 'public'", 400);
    }

    // Build namespaced key
    let fullKey: string;
    try {
      fullKey = buildStorageKey("kv", visibility, payerAddress, key);
    } catch (error) {
      return this.errorResponse(c, String(error), 400);
    }

    // Calculate expiration
    const effectiveTtl = ttl ?? 86400; // Default 1 day
    const expiresAt = new Date(Date.now() + effectiveTtl * 1000).toISOString();

    // Store in KV
    try {
      await c.env.STORAGE.put(fullKey, serializedValue, {
        expirationTtl: effectiveTtl,
        metadata: {
          createdAt: new Date().toISOString(),
          visibility,
          bytes: sizeValidation.bytes,
          valueType: typeof value === "string" ? "string" : "json",
        },
      });
    } catch (error) {
      log.error("KV put error", { error: String(error) });
      return this.errorResponse(c, "Failed to store value", 500);
    }

    return c.json({
      success: true,
      key,
      visibility,
      expiresAt,
      bytes: sizeValidation.bytes,
      tokenType,
    });
  }
}
