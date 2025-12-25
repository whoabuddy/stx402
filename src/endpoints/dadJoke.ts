import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DadJoke extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Generate a dad joke using AI inference",
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
    responses: {
      "200": {
        description: "AI generated dad joke",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                joke: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          } as const,
        } as const,
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

    try {
      const output = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        prompt: "Tell me one dad joke. Respond only with the joke itself, no extra text or explanation.",
        max_tokens: 100,
        temperature: 0.8,
      });
      return c.json({ joke: output.response, tokenType });
    } catch (error) {
      return this.errorResponse(
        c,
        `AI inference failed: ${String(error)}`,
        500
      );
    }
  }
}
