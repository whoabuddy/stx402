import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class Summarize extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Summarize text using AI inference",
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          const: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        } as const,
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              text: {
                type: "string" as const,
                description: "Text to summarize",
              } as const,
              max_length: {
                type: "number" as const,
                description: "Max words in summary",
                default: 100,
              } as const,
            } as const,
          } as const,
        },
      },
    },
    responses: {
      "200": {
        description: "Summary result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                summary: { type: "string" as const } as const,
                original_length: { type: "number" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
      "400": {
        description: "Invalid input",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                error: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
      "402": {
        description: "Payment required",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                maxAmountRequired: { type: "string" as const } as const,
                resource: { type: "string" as const } as const,
                payTo: { type: "string" as const } as const,
                network: {
                  type: "string" as const,
                  const: ["mainnet", "testnet"] as const,
                } as const,
                nonce: { type: "string" as const } as const,
                expiresAt: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                },
              } as const,
            } as const,
          } as const,
        } as const,
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                error: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body;
    try {
      body = await c.req.json<{ text: string; max_length?: number }>();
      if (!body.text || typeof body.text !== "string") {
        return this.errorResponse(c, "Missing or invalid 'text'", 400);
      }
    } catch (error) {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const maxLength = body.max_length || 100;
    const prompt = `Summarize the following text in at most ${maxLength} words:\n\n${body.text}`;

    try {
      const output = await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        prompt,
        max_tokens: 200,
        temperature: 0.3,
      });
      return c.json({
        summary: output,
        original_length: body.text.length,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `AI inference failed: ${String(error)}`, 500);
    }
  }
}
