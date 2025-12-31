import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntryByUrl,
  deleteRegistryEntry,
} from "../utils/registry";
import { Address } from "@stacks/transactions";

export class RegistryDelete extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Delete a registered x402 endpoint (owner only)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["url", "owner"],
            properties: {
              url: {
                type: "string" as const,
                description: "The endpoint URL to delete",
              },
              owner: {
                type: "string" as const,
                description: "Owner STX address (must match registered owner)",
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
        description: "Delete successful",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                deleted: {
                  type: "object" as const,
                  properties: {
                    id: { type: "string" as const },
                    url: { type: "string" as const },
                    name: { type: "string" as const },
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
      "403": {
        description: "Not authorized (not the owner)",
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
      owner?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    if (!body.url) {
      return this.errorResponse(c, "url is required", 400);
    }

    if (!body.owner) {
      return this.errorResponse(c, "owner is required", 400);
    }

    // Validate owner address format
    let ownerAddress: string;
    try {
      const addressObj = Address.parse(body.owner);
      ownerAddress = Address.stringify(addressObj);
    } catch {
      return this.errorResponse(c, "Invalid owner address format", 400);
    }

    // Look up the entry
    const entry = await getRegistryEntryByUrl(c.env.METRICS, body.url);

    if (!entry) {
      return this.errorResponse(c, "Endpoint not found in registry", 404);
    }

    // Verify ownership
    if (entry.owner !== ownerAddress) {
      return c.json(
        {
          error: "Not authorized - you are not the owner of this endpoint",
          registeredOwner: entry.owner,
          tokenType,
        },
        403
      );
    }

    // Store info before deletion for response
    const deletedInfo = {
      id: entry.id,
      url: entry.url,
      name: entry.name,
    };

    // Delete the entry
    const deleted = await deleteRegistryEntry(c.env.METRICS, entry.owner, entry.id);

    if (!deleted) {
      return this.errorResponse(c, "Failed to delete entry", 500);
    }

    return c.json({
      success: true,
      deleted: deletedInfo,
      tokenType,
    });
  }
}
