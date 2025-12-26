import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class ValidateStacksAddress extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Validate a Stacks address",
    parameters: [
      {
        name: "address",
        in: "path" as const,
        required: true,
        schema: {
          type: "string" as const,
          example: "SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF",
        } as const,
      },
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
        description: "Valid Stacks address",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                valid: { type: "boolean" as const, const: true } as const,
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
        description: "Invalid Stacks address",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                valid: { type: "boolean" as const, const: false } as const,
                error: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          } as const,
        } as const,
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
    },
  };

  async handle(c: AppContext) {
    const address = this.validateAddress(c);
    if (address !== null) {
      const tokenType = this.getTokenType(c);
      return c.json({ valid: true, tokenType });
    }
    return this.errorResponse(c, "Invalid Stacks address", 400, {
      valid: false,
    });
  }
}
