import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class SyncLock extends BaseEndpoint {
  schema = {
    tags: ["Sync"],
    summary: "(paid) Acquire a named lock",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["name"],
            properties: {
              name: {
                type: "string" as const,
                description: "Lock name (unique within your namespace)",
                minLength: 1,
                maxLength: 128,
              },
              ttl: {
                type: "number" as const,
                description: "Time to live in seconds (10-300, default 60)",
                minimum: 10,
                maximum: 300,
                default: 60,
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
        description: "Lock acquired or contention response",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                acquired: { type: "boolean" as const },
                name: { type: "string" as const },
                token: { type: "string" as const, nullable: true },
                expiresAt: { type: "string" as const, nullable: true },
                heldUntil: { type: "string" as const, nullable: true },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: { name: string; ttl?: number };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { name, ttl } = body;

    if (!name || typeof name !== "string") {
      return this.errorResponse(c, "Lock name is required", 400);
    }

    if (name.length > 128) {
      return this.errorResponse(c, "Lock name must be 128 characters or less", 400);
    }

    // Validate TTL if provided
    if (ttl !== undefined) {
      if (ttl < 10 || ttl > 300) {
        return this.errorResponse(c, "TTL must be between 10 and 300 seconds", 400);
      }
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.lockAcquire(name, { ttl });

      return c.json({
        ...result,
        name,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Lock acquire error", { error: String(error) });
      return this.errorResponse(c, `Lock operation failed: ${error}`, 500);
    }
  }
}
