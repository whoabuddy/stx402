import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntry,
  getRegistryEntryByUrl,
  updateEntryStatus,
} from "../utils/registry";
import { Address } from "@stacks/transactions";
import { TOKEN_TYPE_PARAM } from "../utils/schema-helpers";

export class RegistryAdminVerify extends BaseEndpoint {
  schema = {
    tags: ["Registry Admin"],
    summary: "(paid, admin only) Verify or reject a registered endpoint",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["url", "action", "adminAddress"],
            properties: {
              url: {
                type: "string",
                description: "The endpoint URL to verify/reject",
              },
              action: {
                type: "string",
                enum: ["verify", "reject"] as const,
                description: "Action to perform",
              },
              adminAddress: {
                type: "string",
                description: "Admin STX address (must match server address)",
              },
            },
          },
        },
      },
    },
    parameters: [TOKEN_TYPE_PARAM],
    responses: {
      "200": {
        description: "Action successful",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                entry: { type: "object" },
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

    const { body, error } = await this.parseJsonBody<{
      url?: string;
      action?: "verify" | "reject";
      adminAddress?: string;
    }>(c);
    if (error) return error;

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
