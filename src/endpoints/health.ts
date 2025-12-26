import { BaseEndpoint } from "./BaseEndpoint";
import { type AppContext } from "../types";

export class Health extends BaseEndpoint {
  schema = {
    tags: ["Health"],
    summary: "Check the STX402 service health",
    request: {},
    responses: {
      "200": {
        description: "Service health status",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                status: { type: "string" as const, const: "ok" } as const,
                details: {
                  type: "object" as const,
                  properties: {
                    timestamp: { type: "string" as const } as const,
                    network: {
                      type: "string" as const,
                      const: ["mainnet", "testnet"] as const,
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
    return c.json({
      status: "ok",
      details: {
        timestamp: new Date().toISOString(),
        network: c.env.X402_NETWORK,
      },
    });
  }
}
