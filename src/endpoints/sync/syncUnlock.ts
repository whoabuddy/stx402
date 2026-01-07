import { BaseEndpoint } from "../BaseEndpoint";
import { log } from "../../utils/logger";
import type { AppContext } from "../../types";
import type { UserDurableObject } from "../../durable-objects/UserDurableObject";

export class SyncUnlock extends BaseEndpoint {
  schema = {
    tags: ["Sync"],
    summary: "(paid) Release a lock (requires token)",
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
        description: "Lock released or error response",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                released: { type: "boolean" as const },
                name: { type: "string" as const },
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

    let body: { name: string; token: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { name, token } = body;

    if (!name || typeof name !== "string") {
      return this.errorResponse(c, "Lock name is required", 400);
    }

    if (!token || typeof token !== "string") {
      return this.errorResponse(c, "Token is required", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.lockRelease(name, token);

      return c.json({
        ...result,
        name,
        tokenType,
      });
    } catch (error) {
      log.error("Lock release error", { error: String(error) });
      return this.errorResponse(c, `Lock operation failed: ${error}`, 500);
    }
  }
}
