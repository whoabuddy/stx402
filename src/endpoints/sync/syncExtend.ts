import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class SyncExtend extends BaseEndpoint {
  schema = {
    tags: ["Sync"],
    summary: "(paid) Extend a lock's TTL (requires token)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["name", "token"],
            properties: {
              name: {
                type: "string" as const,
                description: "Lock name",
              },
              token: {
                type: "string" as const,
                description: "Token received when lock was acquired",
              },
              ttl: {
                type: "number" as const,
                description: "New time to live in seconds (10-300, default 60)",
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
        description: "Lock extended or error response",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                extended: { type: "boolean" as const },
                name: { type: "string" as const },
                expiresAt: { type: "string" as const, nullable: true },
                error: { type: "string" as const, nullable: true },
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

    let body: { name: string; token: string; ttl?: number };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { name, token, ttl } = body;

    if (!name || typeof name !== "string") {
      return this.errorResponse(c, "Lock name is required", 400);
    }

    if (!token || typeof token !== "string") {
      return this.errorResponse(c, "Token is required", 400);
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
      const result = await stub.lockExtend(name, token, { ttl });

      return c.json({
        ...result,
        name,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Lock extend error", { error: String(error) });
      return this.errorResponse(c, `Lock operation failed: ${error}`, 500);
    }
  }
}
