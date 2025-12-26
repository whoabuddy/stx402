import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class CoinToss extends BaseEndpoint {
  schema = {
    tags: ["Games"],
    summary: "(paid) Toss a coin using AI inference",
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
        description: "AI simulated coin toss result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                result: {
                  type: "string" as const,
                  const: ["heads", "tails"] as const,
                } as const,
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
      const output = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
        prompt: "Toss a fair coin once and respond ONLY with 'heads' or 'tails' in lowercase, nothing else.",
        max_tokens: 10,
        temperature: 0,
      });
      const result = output.response.trim().toLowerCase();
      if (!["heads", "tails"].includes(result)) {
        throw new Error("AI did not return valid result");
      }
      return c.json({ result, tokenType });
    } catch (error) {
      return this.errorResponse(
        c,
        `AI inference failed: ${String(error)}`,
        500
      );
    }
  }
}
