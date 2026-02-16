import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { listEntriesByOwner } from "../utils/registry";

export class RegistryMyEndpoints extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) List all endpoints owned by an address (auth via signature or payment)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Owner STX address to list endpoints for (defaults to payer address)",
              },
              signature: {
                type: "string",
                description: "SIP-018 signature proving ownership (optional if paying from same address)",
              },
              timestamp: {
                type: "number",
                description: "Timestamp when signature was created (required with signature)",
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
          type: "string",
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "List of owned endpoints",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                entries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      url: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      category: { type: "string" },
                      status: { type: "string" },
                      registeredAt: { type: "string" },
                    },
                  },
                },
                count: { type: "number" },
                authenticatedBy: { type: "string" },
                signatureRequest: {
                  type: "object",
                  description: "Provided when signature is needed",
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
      "403": {
        description: "Not authorized (invalid signature or payment from different address)",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    if (!c.env.METRICS) {
      return this.errorResponse(c, "Registry storage not configured", 500);
    }

    const parsed = await this.parseJsonBody<{
      owner?: string;
      signature?: string;
      timestamp?: number;
    }>(c);
    if (parsed.error) return parsed.error;
    const body = parsed.body;

    // Resolve owner address
    const ownerResult = this.resolveOwnerAddress(c, body.owner);
    if (ownerResult.error) return ownerResult.error;
    const ownerAddress = ownerResult.address;

    // Authenticate via signature or payment
    const authResult = this.authenticateOwner(
      c,
      ownerAddress,
      body.signature,
      body.timestamp,
      "list-my-endpoints",
      { owner: ownerAddress }
    );
    if (!authResult.authenticated) return authResult.error;

    // Authenticated - fetch the entries
    const entries = await listEntriesByOwner(c.env.METRICS, ownerAddress);

    return c.json({
      entries: entries.map((e) => ({
        id: e.id,
        url: e.url,
        name: e.name,
        description: e.description,
        category: e.category,
        status: e.status,
        tags: e.tags,
        registeredAt: e.registeredAt,
        updatedAt: e.updatedAt,
        probeData: e.probeData ? {
          paymentAddress: e.probeData.paymentAddress,
          acceptedTokens: e.probeData.acceptedTokens,
          responseTimeMs: e.probeData.responseTimeMs,
        } : null,
      })),
      count: entries.length,
      authenticatedBy: authResult.method,
      tokenType,
    });
  }
}
