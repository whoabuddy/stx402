import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import type { UserDurableObject } from "../../durable-objects/UserDurableObject";

export class MemorySearch extends BaseEndpoint {
  schema = {
    tags: ["Memory"],
    summary: "(paid) Search memories semantically using AI embeddings",
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
                description: "Natural language search query",
                minLength: 1,
                maxLength: 1000,
              },
              limit: {
                type: "number" as const,
                description: "Maximum results to return (default 10, max 100)",
                minimum: 1,
                maximum: 100,
                default: 10,
              },
              filter: {
                type: "object" as const,
                properties: {
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
                  minSimilarity: {
                    type: "number" as const,
                    description: "Minimum similarity threshold (0-1, default 0.5)",
                    minimum: 0,
                    maximum: 1,
                    default: 0.5,
                  },
                },
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
        description: "Search results",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                query: { type: "string" as const },
                results: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      key: { type: "string" as const },
                      content: { type: "string" as const },
                      summary: { type: "string" as const },
                      tags: {
                        type: "array" as const,
                        items: { type: "string" as const },
                      },
                      type: { type: "string" as const },
                      importance: { type: "number" as const },
                      similarity: { type: "number" as const },
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

    let body: {
      query: string;
      limit?: number;
      filter?: {
        tags?: string[];
        type?: string;
        minImportance?: number;
        minSimilarity?: number;
      };
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { query, limit, filter } = body;

    if (!query || typeof query !== "string") {
      return this.errorResponse(c, "Query is required", 400);
    }

    if (query.length > 1000) {
      return this.errorResponse(c, "Query must be 1000 characters or less", 400);
    }

    // Generate embedding for the query
    let queryEmbedding: number[];

    try {
      const embeddingResult = await c.env.AI.run("@cf/baai/bge-base-en-v1.5", {
        text: query,
      });

      if (!embeddingResult.data || !embeddingResult.data[0]) {
        return this.errorResponse(c, "Failed to generate query embedding", 500);
      }

      queryEmbedding = embeddingResult.data[0];
    } catch (error) {
      console.error("Embedding generation error:", error);
      return this.errorResponse(c, "Failed to generate query embedding", 500);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const results = await stub.memorySearch(queryEmbedding, {
        limit,
        minSimilarity: filter?.minSimilarity,
        tags: filter?.tags,
        type: filter?.type,
        minImportance: filter?.minImportance,
      });

      return c.json({
        query,
        results,
        count: results.length,
        tokenType,
      });
    } catch (error) {
      console.error("Memory search error:", error);
      return this.errorResponse(c, `Memory search failed: ${error}`, 500);
    }
  }
}
