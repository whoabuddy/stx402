import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class SyncList extends BaseEndpoint {
  schema = {
    tags: ["Sync"],
    summary: "(paid) List all active locks",
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
        description: "List of active locks",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                locks: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      name: { type: "string" as const },
                      expiresAt: { type: "string" as const },
                      acquiredAt: { type: "string" as const },
                    },
                  },
                },
                count: { type: "number" as const },
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

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const locks = await stub.lockList();

      return c.json({
        locks,
        count: locks.length,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Lock list error", { error: String(error) });
      return this.errorResponse(c, `Lock operation failed: ${error}`, 500);
    }
  }
}
