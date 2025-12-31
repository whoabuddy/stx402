import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntry,
  getRegistryEntryByUrl,
  generateUrlHash,
} from "../utils/registry";
import { probeX402Endpoint } from "../utils/probe";

export class RegistryDetails extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Get full details of a registered x402 endpoint with live health check",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              url: {
                type: "string" as const,
                description: "The endpoint URL to look up",
              },
              id: {
                type: "string" as const,
                description: "The endpoint ID (alternative to URL)",
              },
              owner: {
                type: "string" as const,
                description: "Owner address (required if using id)",
              },
              liveProbe: {
                type: "boolean" as const,
                description: "Perform a live health check (default: true)",
                default: true,
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "Full endpoint details",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                entry: {
                  type: "object" as const,
                  properties: {
                    id: { type: "string" as const },
                    url: { type: "string" as const },
                    name: { type: "string" as const },
                    description: { type: "string" as const },
                    owner: { type: "string" as const },
                    status: { type: "string" as const },
                    category: { type: "string" as const },
                    tags: {
                      type: "array" as const,
                      items: { type: "string" as const },
                    },
                    registeredAt: { type: "string" as const },
                    updatedAt: { type: "string" as const },
                    registeredBy: { type: "string" as const },
                    probeData: { type: "object" as const },
                  },
                },
                liveStatus: {
                  type: "object" as const,
                  properties: {
                    isOnline: { type: "boolean" as const },
                    responseTimeMs: { type: "number" as const },
                    checkedAt: { type: "string" as const },
                  },
                },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid request",
      },
      "402": {
        description: "Payment required",
      },
      "404": {
        description: "Endpoint not found in registry",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    // Check if METRICS (KV) is configured
    if (!c.env.METRICS) {
      return this.errorResponse(c, "Registry storage not configured", 500);
    }

    let body: {
      url?: string;
      id?: string;
      owner?: string;
      liveProbe?: boolean;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    // Must provide either url or (id + owner)
    if (!body.url && !body.id) {
      return this.errorResponse(c, "Either url or id is required", 400);
    }

    if (body.id && !body.owner) {
      return this.errorResponse(c, "owner is required when using id lookup", 400);
    }

    // Look up the entry
    let entry;
    if (body.url) {
      entry = await getRegistryEntryByUrl(c.env.METRICS, body.url);
    } else {
      entry = await getRegistryEntry(c.env.METRICS, body.owner!, body.id!);
    }

    if (!entry) {
      return this.errorResponse(c, "Endpoint not found in registry", 404);
    }

    // Perform live probe if requested (default: true)
    let liveStatus: {
      isOnline: boolean;
      responseTimeMs?: number;
      checkedAt: string;
      error?: string;
    } | undefined;

    if (body.liveProbe !== false) {
      const probeResult = await probeX402Endpoint(entry.url, { timeout: 10000 });
      liveStatus = {
        isOnline: probeResult.success && probeResult.isX402Endpoint,
        responseTimeMs: probeResult.data?.responseTimeMs,
        checkedAt: new Date().toISOString(),
        error: probeResult.error,
      };
    }

    return c.json({
      entry,
      liveStatus,
      tokenType,
    });
  }
}
