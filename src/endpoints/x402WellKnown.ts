/**
 * X402 Well-Known Manifest Endpoint
 *
 * Serves /x402.json V2 discovery manifest for Bazaar/scanner registration.
 * Generates manifest directly from ENDPOINT_TIERS — no network calls needed.
 *
 * V2 format: per-endpoint items[] with CAIP-2 network IDs, resource objects,
 * service metadata, and Bazaar extensions.
 */

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { generateX402Manifest } from "../utils/x402-schema";

export class X402WellKnown extends BaseEndpoint {
  schema = {
    tags: ["Discovery"],
    summary: "X402 V2 service discovery manifest",
    description:
      "Returns the x402.json V2 discovery manifest for Bazaar/scanner registration. " +
      "Lists all paid endpoints grouped per-endpoint with CAIP-2 network IDs, " +
      "resource objects, payment requirements, and Bazaar extensions.",
    responses: {
      "200": {
        description: "X402 V2 discovery manifest",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                version: {
                  type: "string",
                  description: "Manifest version (2.0)",
                  example: "2.0",
                },
                service: {
                  type: "object",
                  description: "Service metadata",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    url: { type: "string" },
                  },
                },
                lastUpdated: {
                  type: "string",
                  description: "ISO 8601 timestamp of manifest generation",
                },
                items: {
                  type: "array",
                  description: "Per-endpoint payment discovery entries",
                  items: {
                    type: "object",
                    properties: {
                      resource: {
                        type: "object",
                        properties: {
                          url: { type: "string" },
                          description: { type: "string" },
                          mimeType: { type: "string" },
                        },
                      },
                      paymentRequirements: {
                        type: "array",
                        items: { type: "object" },
                      },
                      extensions: { type: "object" },
                    },
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
    const url = new URL(c.req.url);
    const isLocalhost =
      url.host.includes("localhost") || url.host.includes("127.0.0.1");
    const baseUrl = isLocalhost
      ? `${url.protocol}//${url.host}`
      : `https://${url.host}`;

    const manifest = generateX402Manifest({
      network: (c.env.X402_NETWORK as "mainnet" | "testnet") || "mainnet",
      payTo: c.env.X402_SERVER_ADDRESS,
      baseUrl,
      facilitatorUrl: c.env.X402_FACILITATOR_URL,
    });

    return c.json(manifest);
  }
}
