import { BaseEndpoint } from "./BaseEndpoint";
import { DEFAULT_AMOUNTS } from "../utils/pricing";
import type { AppContext } from "../types";

export class BetCoinToss extends BaseEndpoint {
  schema = {
    tags: ["Betting"],
    summary: "(paid) Bet on provably fair coin toss using x402 payment txId",
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
              side: {
                type: "string" as const,
                const: ["heads", "tails"] as const,
                description: "Your bet: heads or tails",
              } as const,
            } as const,
            required: ["side"] as const,
          } as const,
        },
      },
    },
    responses: {
      "200": {
        description: "Bet result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                yourBet: {
                  type: "string" as const,
                  const: ["heads", "tails"] as const,
                } as const,
                outcome: {
                  type: "string" as const,
                  const: ["heads", "tails"] as const,
                } as const,
                won: { type: "boolean" as const } as const,
                multiplier: { type: "number" as const } as const,
                virtualPayout: { type: "string" as const } as const,
                txId: { type: "string" as const } as const,
                verify: { type: "string" as const } as const,
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
    const settleHeader = c.req.header("X-PAYMENT-RESPONSE");
    if (!settleHeader) {
      return this.errorResponse(c, "No payment response header", 400);
    }

    let body;
    try {
      body = await c.req.json<{ side: "heads" | "tails" }>();
      if (!body.side || !["heads", "tails"].includes(body.side)) {
        return this.errorResponse(c, "Invalid side: must be 'heads' or 'tails'", 400);
      }
    } catch (error) {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    let settleResult;
    try {
      settleResult = JSON.parse(settleHeader);
    } catch (error) {
      return this.errorResponse(c, "Invalid payment response header", 400);
    }

    const txId = settleResult.txId;
    if (!txId) {
      return this.errorResponse(c, "No txId in payment response", 400);
    }

    const seed = `${txId}${body.side}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const outcomeIndex = hashArray[0] % 2;
    const outcome = outcomeIndex === 0 ? "heads" : "tails";
    const won = body.side === outcome;
    const multiplier = won ? 1.9 : 0;
    const baseStake = parseFloat(DEFAULT_AMOUNTS[tokenType as keyof typeof DEFAULT_AMOUNTS]);
    const virtualPayout = `${(multiplier * baseStake).toFixed(6)} ${tokenType}`;
    const verifyHashMod = outcomeIndex;

    return c.json({
      yourBet: body.side,
      outcome,
      won,
      multiplier,
      virtualPayout,
      txId,
      verify: `SHA256("${txId}${body.side}") % 2 === ${verifyHashMod}`,
      tokenType,
    });
  }
}
