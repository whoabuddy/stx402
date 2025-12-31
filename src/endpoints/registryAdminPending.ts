import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { listEntriesByStatus } from "../utils/registry";
import { Address } from "@stacks/transactions";

export class RegistryAdminPending extends BaseEndpoint {
  schema = {
    tags: ["Registry Admin"],
    summary: "(paid, admin only) List all pending (unverified) endpoints",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["adminAddress"],
            properties: {
              adminAddress: {
                type: "string" as const,
                description: "Admin STX address (must match server address)",
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
        description: "List of pending entries",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                entries: {
                  type: "array" as const,
                  items: { type: "object" as const },
                },
                count: { type: "number" as const },
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
      "403": {
        description: "Not authorized (not admin)",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    if (!c.env.METRICS) {
      return this.errorResponse(c, "Registry storage not configured", 500);
    }

    let body: {
      adminAddress?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    if (!body.adminAddress) {
      return this.errorResponse(c, "adminAddress is required", 400);
    }

    // Validate admin address format
    let adminAddress: string;
    try {
      const addressObj = Address.parse(body.adminAddress);
      adminAddress = Address.stringify(addressObj);
    } catch {
      return this.errorResponse(c, "Invalid adminAddress format", 400);
    }

    // Verify admin is the server address
    if (adminAddress !== c.env.X402_SERVER_ADDRESS) {
      return c.json(
        {
          error: "Not authorized - only server admin can view pending entries",
          tokenType,
        },
        403
      );
    }

    // Get all unverified entries
    const entries = await listEntriesByStatus(c.env.METRICS, "unverified");

    return c.json({
      entries: entries.map((e) => ({
        id: e.id,
        url: e.url,
        name: e.name,
        description: e.description,
        owner: e.owner,
        category: e.category,
        registeredAt: e.registeredAt,
        probeData: e.probeData
          ? {
              isX402Endpoint: true,
              paymentAddress: e.probeData.paymentAddress,
              responseTimeMs: e.probeData.responseTimeMs,
            }
          : null,
      })),
      count: entries.length,
      tokenType,
    });
  }
}
