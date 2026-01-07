import { BaseEndpoint } from "../BaseEndpoint";
import { log } from "../../utils/logger";
import type { AppContext } from "../../types";

export class SyncCheck extends BaseEndpoint {
  schema = {
    tags: ["Sync"],
    summary: "(paid) Check the status of a lock",
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
                description: "Lock name to check",
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
        description: "Lock status",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                name: { type: "string" as const },
                locked: { type: "boolean" as const },
                expiresAt: { type: "string" as const, nullable: true },
                acquiredAt: { type: "string" as const, nullable: true },
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

    let body: { name: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { name } = body;

    if (!name || typeof name !== "string") {
      return this.errorResponse(c, "Lock name is required", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.lockCheck(name);

      return c.json({
        name,
        ...result,
        tokenType,
      });
    } catch (error) {
      log.error("Lock check error", { error: String(error) });
      return this.errorResponse(c, `Lock operation failed: ${error}`, 500);
    }
  }
}
