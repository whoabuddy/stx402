import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class CounterList extends BaseEndpoint {
  schema = {
    tags: ["Counter"],
    summary: "(paid) List all counters for the user",
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
        description: "Counters listed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                counters: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      name: { type: "string" as const },
                      value: { type: "number" as const },
                      min: { type: "number" as const, nullable: true },
                      max: { type: "number" as const, nullable: true },
                      updatedAt: { type: "string" as const },
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
      const counters = await stub.counterList();
      return c.json({
        counters,
        count: counters.length,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Counter list error", { error: String(error) });
      return this.errorResponse(c, `Counter operation failed: ${error}`, 500);
    }
  }
}
