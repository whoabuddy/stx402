import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class SqlSchema extends BaseEndpoint {
  schema = {
    tags: ["SQL"],
    summary: "(paid) Get database schema (list tables and their definitions)",
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
        description: "Schema retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                tables: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      name: { type: "string" as const },
                      sql: { type: "string" as const },
                    },
                  },
                },
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
      const result = await stub.sqlSchema();
      return c.json({ ...result, tokenType });
    } catch (error) {
      c.var.logger.error("SQL schema error", { error: String(error) });
      return this.errorResponse(c, `Schema operation failed: ${error}`, 500);
    }
  }
}
