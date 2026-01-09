import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class SqlExecute extends BaseEndpoint {
  schema = {
    tags: ["SQL"],
    summary: "(paid) Execute write SQL query (CREATE, INSERT, UPDATE, DELETE)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["query"],
            properties: {
              query: {
                type: "string" as const,
                description: "SQL query to execute (CREATE TABLE, INSERT, UPDATE, DELETE)",
                maxLength: 4096,
              },
              params: {
                type: "array" as const,
                description: "Query parameters (for prepared statements)",
                items: {},
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
        description: "Query executed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                rowsAffected: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request or query" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: {
      query: string;
      params?: unknown[];
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { query, params = [] } = body;

    if (!query || typeof query !== "string") {
      return this.errorResponse(c, "Query is required", 400);
    }

    if (query.length > 4096) {
      return this.errorResponse(c, "Query must be 4096 characters or less", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.sqlExecute(query, params);
      return c.json({ ...result, tokenType });
    } catch (error) {
      c.var.logger.error("SQL execute error", { error: String(error) });
      const message = error instanceof Error ? error.message : String(error);
      return this.errorResponse(c, message, 400);
    }
  }
}
