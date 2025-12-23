import { BaseEndpoint } from "./BaseEndpoint";
import { convertAddressToNetwork } from "../utils/addresses";
import type { AppContext } from "../types";

export class ConvertAddressToNetwork extends BaseEndpoint {
  schema = {
    tags: ["Addresses"],
    summary: "Convert Stacks address to specified network",
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
        name: "network",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          const: ["mainnet", "testnet"] as const,
          default: "mainnet",
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
        description: "Converted address",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const } as const,
                convertedAddress: { type: "string" as const } as const,
                network: {
                  type: "string" as const,
                  const: ["mainnet", "testnet"] as const,
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
                tokenType: { type: "string" as const, const: ["STX", "sBTC", "USDCx"] as const } as const,
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
                tokenType: { type: "string" as const, const: ["STX", "sBTC", "USDCx"] as const } as const,
              } as const,
            } as const,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const address = this.validateAddress(c);
    if (!address) {
      return this.errorResponse(c, "Invalid Stacks address", 400);
    }

    const networkRaw = c.req.query("network") || "mainnet";
    const network = networkRaw.toLowerCase() as "mainnet" | "testnet";
    if (!["mainnet", "testnet"].includes(network)) {
      return this.errorResponse(
        c,
        "Invalid network. Must be 'mainnet' or 'testnet'.",
        400
      );
    }

    const tokenType = this.getTokenType(c);

    try {
      const convertedAddress = convertAddressToNetwork(address, network);
      return c.json({ address, convertedAddress, network, tokenType });
    } catch (error) {
      return this.errorResponse(
        c,
        `Internal server error: ${String(error)}`,
        500
      );
    }
  }
}
