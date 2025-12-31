import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntry,
  getRegistryEntryByUrl,
  updateEntryStatus,
} from "../utils/registry";
import { Address } from "@stacks/transactions";

export class RegistryAdminVerify extends BaseEndpoint {
  schema = {
    tags: ["Registry Admin"],
    summary: "(paid, admin only) Verify or reject a registered endpoint",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["url", "action", "adminAddress"],
            properties: {
              url: {
                type: "string" as const,
                description: "The endpoint URL to verify/reject",
              },
              action: {
                type: "string" as const,
                enum: ["verify", "reject"] as const,
                description: "Action to perform",
              },
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
        description: "Action successful",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                entry: { type: "object" as const },
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
      "404": {
        description: "Endpoint not found",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    if (!c.env.METRICS) {
      return this.errorResponse(c, "Registry storage not configured", 500);
    }

    let body: {
      url?: string;
      action?: "verify" | "reject";
      adminAddress?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    if (!body.url) {
      return this.errorResponse(c, "url is required", 400);
    }

    if (!body.action || !["verify", "reject"].includes(body.action)) {
      return this.errorResponse(c, "action must be 'verify' or 'reject'", 400);
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
          error: "Not authorized - only server admin can verify/reject entries",
          tokenType,
        },
        403
      );
    }

    // Look up the entry
    const entry = await getRegistryEntryByUrl(c.env.METRICS, body.url);

    if (!entry) {
      return this.errorResponse(c, "Endpoint not found in registry", 404);
    }

    // Update status
    const newStatus = body.action === "verify" ? "verified" : "rejected";
    const updatedEntry = await updateEntryStatus(
      c.env.METRICS,
      entry.owner,
      entry.id,
      newStatus
    );

    if (!updatedEntry) {
      return this.errorResponse(c, "Failed to update entry status", 500);
    }

    return c.json({
      success: true,
      action: body.action,
      entry: {
        id: updatedEntry.id,
        url: updatedEntry.url,
        name: updatedEntry.name,
        owner: updatedEntry.owner,
        status: updatedEntry.status,
        updatedAt: updatedEntry.updatedAt,
      },
      tokenType,
    });
  }
}
