import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class MemoryStore extends BaseEndpoint {
  schema = {
    tags: ["Memory"],
    summary: "(paid) Store a memory with metadata and optional embedding",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["key", "content"],
            properties: {
              key: {
                type: "string" as const,
                description: "Unique memory key",
                minLength: 1,
                maxLength: 256,
              },
              content: {
                type: "string" as const,
                description: "Memory content (text to store)",
                maxLength: 100000,
              },
              metadata: {
                type: "object" as const,
                properties: {
                  tags: {
                    type: "array" as const,
                    items: { type: "string" as const },
                    description: "Tags for categorization",
                  },
                  type: {
                    type: "string" as const,
                    enum: ["fact", "conversation", "task", "note"] as const,
                    description: "Memory type (default: note)",
                    default: "note",
                  },
                  importance: {
                    type: "number" as const,
                    description: "Importance score 0-10 (default: 5)",
                    minimum: 0,
                    maximum: 10,
                    default: 5,
                  },
                  source: {
                    type: "string" as const,
                    description: "Source of the memory (e.g., 'user', 'chat', 'api')",
                  },
                },
              },
              generateEmbedding: {
                type: "boolean" as const,
                description: "Generate embedding for semantic search (default: true)",
                default: true,
              },
              ttl: {
                type: "number" as const,
                description: "Time-to-live in seconds (optional)",
                minimum: 60,
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
        description: "Memory stored successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                key: { type: "string" as const },
                stored: { type: "boolean" as const },
                hasEmbedding: { type: "boolean" as const },
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
      key: string;
      content: string;
      metadata?: {
        tags?: string[];
        type?: "fact" | "conversation" | "task" | "note";
        importance?: number;
        source?: string;
      };
      generateEmbedding?: boolean;
      ttl?: number;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { key, content, metadata, generateEmbedding = true, ttl } = body;

    if (!key || typeof key !== "string") {
      return this.errorResponse(c, "Key is required", 400);
    }

    if (key.length > 256) {
      return this.errorResponse(c, "Key must be 256 characters or less", 400);
    }

    if (!content || typeof content !== "string") {
      return this.errorResponse(c, "Content is required", 400);
    }

    if (content.length > 100000) {
      return this.errorResponse(c, "Content must be 100,000 characters or less", 400);
    }

    // Generate embedding if requested
    let embedding: number[] | undefined;
    let summary: string | undefined;

    if (generateEmbedding) {
      try {
        // Generate embedding using Cloudflare AI
        const embeddingResult = await c.env.AI.run("@cf/baai/bge-base-en-v1.5", {
          text: content.substring(0, 8000), // Limit input size for embedding model
        });

        if (embeddingResult.data && embeddingResult.data[0]) {
          embedding = embeddingResult.data[0];
        }

        // Generate summary for long content
        if (content.length > 500) {
          const summaryResult = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              {
                role: "system",
                content: "Summarize the following text in 1-2 sentences. Be concise.",
              },
              {
                role: "user",
                content: content.substring(0, 4000),
              },
            ],
            max_tokens: 100,
          });

          if (summaryResult.response) {
            summary = summaryResult.response;
          }
        }
      } catch (error) {
        c.var.logger.error("Embedding/summary generation error", { error: String(error) });
        // Continue without embedding - non-fatal
      }
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.memoryStore(key, content, {
        summary,
        tags: metadata?.tags,
        type: metadata?.type,
        importance: metadata?.importance,
        source: metadata?.source,
        embedding,
        ttl,
      });

      return c.json({
        ...result,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Memory store error", { error: String(error) });
      return this.errorResponse(c, `Memory operation failed: ${error}`, 500);
    }
  }
}
