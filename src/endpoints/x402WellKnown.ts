/**
 * X402 Schema Endpoint
 *
 * Serves /x402.json for StacksX402 scanner discovery.
 * Generates schema directly from endpoint registry and pricing tiers.
 */

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { generateX402SchemaStatic } from "../utils/x402-schema";

export class X402WellKnown extends BaseEndpoint {
  schema = {
    tags: ["Discovery"],
    summary: "X402 service discovery schema",
    description:
      "Returns the x402.json schema for StacksX402 scanner discovery. " +
      "Lists all paid endpoints with their pricing.",
    responses: {
      "200": {
        description: "X402 discovery schema",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                x402Version: {
                  type: "number" as const,
                  description: "X402 schema version",
                },
                name: {
                  type: "string" as const,
                  description: "Service name",
                },
                image: {
                  type: "string" as const,
                  description: "Service logo URL",
                },
                accepts: {
                  type: "array" as const,
                  description: "List of paid endpoints with payment details",
                  items: {
                    type: "object" as const,
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    // Determine canonical URL for image
    const url = new URL(c.req.url);
    const isLocalhost = url.host.includes("localhost") || url.host.includes("127.0.0.1");
    const canonicalUrl = isLocalhost ? `${url.protocol}//${url.host}` : `https://${url.host}`;

    const schema = generateX402SchemaStatic({
      network: (c.env.X402_NETWORK as "mainnet" | "testnet") || "mainnet",
      payTo: c.env.X402_SERVER_ADDRESS,
      name: "stx402 Directory",
      image: `${canonicalUrl}/favicon.svg`,
    });

    return c.json(schema);
  }
}
