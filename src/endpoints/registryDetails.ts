import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntry,
  getRegistryEntryByUrl,
  generateUrlHash,
} from "../utils/registry";
import { probeX402Endpoint } from "../utils/probe";
import { TOKEN_TYPE_PARAM } from "../utils/schema-helpers";

export class RegistryDetails extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Get full details of a registered x402 endpoint with live health check",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The endpoint URL to look up",
              },
              id: {
                type: "string",
                description: "The endpoint ID (alternative to URL)",
              },
              owner: {
                type: "string",
                description: "Owner address (required if using id)",
              },
              liveProbe: {
                type: "boolean",
                description: "Perform a live health check (default: true)",
                default: true,
              },
            },
          },
        },
      },
    },
    parameters: [TOKEN_TYPE_PARAM],
    responses: {
      "200": {
        description: "Full endpoint details",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                entry: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    url: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    owner: { type: "string" },
                    status: { type: "string" },
                    category: { type: "string" },
                    tags: {
                      type: "array",
                      items: { type: "string" },
                    },
                    registeredAt: { type: "string" },
                    updatedAt: { type: "string" },
                    registeredBy: { type: "string" },
                    probeData: { type: "object" },
                  },
                },
                liveStatus: {
                  type: "object",
                  properties: {
                    isOnline: { type: "boolean" },
                    responseTimeMs: { type: "number" },
                    checkedAt: { type: "string" },
                  },
                },
                tokenType: { type: "string" },
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

    const { body, error } = await this.parseJsonBody<{
      url?: string;
      id?: string;
      owner?: string;
      liveProbe?: boolean;
    }>(c);
    if (error) return error;

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
