import { BaseEndpoint } from "./BaseEndpoint";
import { DEFAULT_AMOUNTS } from "../utils/pricing";
import type { AppContext } from "../types";

export class BetDice extends BaseEndpoint {
  schema = {
    tags: ["Betting"],
    summary: "(paid) Bet on provably fair dice roll (1-100) using x402 payment txId",
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
              maxRoll: {
                type: "integer" as const,
                minimum: 1,
                maximum: 99,
                description: "Win if roll <= maxRoll (1-99)",
              } as const,
            } as const,
            required: ["maxRoll"] as const,
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
                maxRoll: { type: "integer" as const } as const,
                roll: { type: "integer" as const, minimum: 1, maximum: 100 } as const,
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
      body = await c.req.json<{ maxRoll: number }>();
      if (!body.maxRoll || typeof body.maxRoll !== "number" || body.maxRoll < 1 || body.maxRoll > 99) {
        return this.errorResponse(c, "Invalid maxRoll: must be integer 1-99", 400);
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

    const seed = `${txId}${body.maxRoll}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const roll = ((hashArray[0] * 256 + hashArray[1]) % 100) + 1;
    const won = roll <= body.maxRoll;
    const multiplier = won ? (99 / body.maxRoll) : 0;
    const baseStake = parseFloat(DEFAULT_AMOUNTS[tokenType as keyof typeof DEFAULT_AMOUNTS]);
    const virtualPayout = `${(multiplier * baseStake).toFixed(6)} ${tokenType}`;

    return c.json({
      maxRoll: body.maxRoll,
      roll,
      won,
      multiplier: Number(multiplier.toFixed(2)),
      virtualPayout,
      txId,
      verify: `SHA256("${txId}${body.maxRoll}") % 100 + 1 = ${roll} (<= ${body.maxRoll} = win)`,
      tokenType,
    });
  }
}
