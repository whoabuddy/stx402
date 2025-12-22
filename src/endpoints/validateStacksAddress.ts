import { OpenAPIRoute } from "chanfana";
import { validateStacksAddress } from "@stacks/transactions";
import type { AppContext } from "../types";

export class ValidateStacksAddress extends OpenAPIRoute {
  schema = {
    tags: ["Stacks"],
    summary: "Validate a Stacks address",
    parameters: [
      {
        name: "address",
        in: "path" as const,
        required: true,
        schema: {
          type: "string" as const,
          example: "SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF",
        },
      },
    ] as const,
    responses: {
      "200": {
        description: "Valid Stacks address",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                valid: { type: "boolean" as const, const: true },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid Stacks address",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                valid: { type: "boolean" as const, const: false },
                error: { type: "string" },
              },
            },
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
                maxAmountRequired: { type: "string" },
                resource: { type: "string" },
                payTo: { type: "string" },
                network: { type: "string", enum: ["mainnet", "testnet"] },
                nonce: { type: "string" },
                expiresAt: { type: "string" },
                tokenType: { type: "string", enum: ["STX", "sBTC"] },
              },
              required: ["maxAmountRequired", "resource", "payTo", "network", "nonce", "expiresAt"],
            },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const address = c.req.param("address");
    if (validateStacksAddress(address)) {
      return { valid: true };
    }
    return c.json({ valid: false, error: "Invalid Stacks address" }, 400);
  }
}
