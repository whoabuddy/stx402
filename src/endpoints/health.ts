import { BaseEndpoint } from "./BaseEndpoint";
import { type AppContext } from "../types";

export class Health extends BaseEndpoint {
  schema = {
    tags: ["Health"],
    summary: "Check the STX402 service health",
    responses: {
      "200": {
        description: "Service health status",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", const: "ok" } as const,
                details: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" } as const,
                    network: {
                      type: "string",
                      enum: ["mainnet", "testnet"] as const,
                    } as const,
                    environment: {
                      type: "string",
                      enum: ["production", "staging"] as const,
                    } as const,
                  } as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const network = c.env.X402_NETWORK;
    return c.json({
      status: "ok",
      details: {
        timestamp: new Date().toISOString(),
        network,
        environment: network === "mainnet" ? "production" : "staging",
      },
    });
  }
}
