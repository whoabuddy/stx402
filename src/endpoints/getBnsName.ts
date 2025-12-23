import { OpenAPIRoute } from "chanfana";
import { validateStacksAddress } from "@stacks/transactions";
import { getNameFromAddress } from "../utils/bns";
import { validateTokenType } from "../utils/pricing";
import type { AppContext } from "../types";

export class GetBnsName extends OpenAPIRoute {
  schema = {
    tags: ["BNS"],
    summary: "Get primary BNSV2 name for Stacks address",
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
        description: "BNS name",
        content: {
          "text/plain": {
            schema: { type: "string" as const, example: "stacks.btc" } as const,
          },
        },
      },
      "400": {
        description: "Invalid address",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: { error: { type: "string" as const } as const },
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
                tokenType: { type: "string" as const, const: ["STX", "sBTC", "USDCx"] as const },
              } as const,
            } as const,
          } as const,
        } as const,
      },
      "404": {
        description: "No name found",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: { error: { type: "string" as const } as const },
            } as const,
          },
        },
      },
      "500": {
        description: "Fetch error",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: { error: { type: "string" as const } as const },
            } as const,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const address = c.req.param("address");
    if (!validateStacksAddress(address)) {
      return c.json({ error: "Invalid Stacks address" }, 400);
    }

    const rawTokenType = c.req.query("tokenType") || "STX";
    const tokenType = validateTokenType(rawTokenType);

    try {
      const name = await getNameFromAddress(address);
      if (!name) {
        return c.json({ error: "No BNS name found" }, 404);
      }
      return c.text(name); // Plain text 200
    } catch (error) {
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
