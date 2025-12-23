import { BaseEndpoint } from "./BaseEndpoint";
import { hexToCV } from "@stacks/transactions";
import { decodeClarityValues } from "../utils/clarity";
import type { AppContext } from "../types";

export class DecodeClarityHex extends BaseEndpoint {
  schema = {
    tags: ["Clarity"],
    summary: "(paid) Decode Clarity value from hex string",
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
              hex: {
                type: "string" as const,
                description: "Hex string representing Clarity value",
                example: "0x0d0000000a68656c6c6f2078343032",
              } as const,
            } as const,
          } as const,
        },
      },
    },
    responses: {
      "200": {
        description: "Decoded Clarity value",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                decoded: {
                  type: "object" as const,
                  additionalProperties: true,
                } as const,
                hex: { type: "string" as const } as const,
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

    let hex: string;
    try {
      const body = await c.req.json<{ hex: string }>();
      hex = body.hex;
      if (!hex || typeof hex !== "string") {
        return this.errorResponse(
          c,
          "Missing or invalid 'hex' in request body",
          400
        );
      }
    } catch (error) {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    let cv;
    try {
      cv = hexToCV(hex);
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to parse hex as ClarityValue: ${String(error)}`,
        400
      );
    }

    try {
      const decoded = decodeClarityValues(cv);
      return c.json({ decoded, hex, tokenType });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to decode ClarityValue: ${String(error)}`,
        500
      );
    }
  }
}
