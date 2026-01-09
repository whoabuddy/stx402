import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class MemoryList extends BaseEndpoint {
  schema = {
    tags: ["Memory"],
    summary: "(paid) List memories with optional filters",
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              prefix: {
                type: "string" as const,
                description: "Filter by key prefix",
              },
              tags: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Filter by tags (matches any)",
              },
              type: {
                type: "string" as const,
                enum: ["fact", "conversation", "task", "note"] as const,
                description: "Filter by memory type",
              },
              minImportance: {
                type: "number" as const,
                description: "Minimum importance score (0-10)",
                minimum: 0,
                maximum: 10,
              },
              limit: {
                type: "number" as const,
                description: "Maximum results to return (default 50, max 500)",
                minimum: 1,
                maximum: 500,
                default: 50,
              },
              offset: {
                type: "number" as const,
                description: "Number of results to skip (for pagination)",
                minimum: 0,
                default: 0,
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
        description: "Memory list",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                memories: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      key: { type: "string" as const },
                      summary: { type: "string" as const },
                      tags: {
                        type: "array" as const,
                        items: { type: "string" as const },
                      },
                      type: { type: "string" as const },
                      importance: { type: "number" as const },
                      hasEmbedding: { type: "boolean" as const },
                      createdAt: { type: "string" as const },
                      updatedAt: { type: "string" as const },
                    },
                  },
                },
                total: { type: "number" as const },
                hasMore: { type: "boolean" as const },
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

    let body: {
      prefix?: string;
      tags?: string[];
      type?: string;
      minImportance?: number;
      limit?: number;
      offset?: number;
    } = {};

    try {
      const text = await c.req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { prefix, tags, type, minImportance, limit, offset } = body;

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.memoryList({
        prefix,
        tags,
        type,
        minImportance,
        limit,
        offset,
      });

      return c.json({
        ...result,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Memory list error", { error: String(error) });
      return this.errorResponse(c, `Memory operation failed: ${error}`, 500);
    }
  }
}
