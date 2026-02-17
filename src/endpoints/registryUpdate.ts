import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntryByUrl,
  saveRegistryEntry,
} from "../utils/registry";
import { probeX402Endpoint } from "../utils/probe";

export class RegistryUpdate extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Update a registered x402 endpoint (owner only, signature or payment auth)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["url"],
            properties: {
              url: {
                type: "string",
                description: "The endpoint URL to update",
              },
              owner: {
                type: "string",
                description: "Owner STX address (defaults to payer address, must match registered owner)",
              },
              name: {
                type: "string",
                description: "New display name",
              },
              description: {
                type: "string",
                description: "New description",
              },
              category: {
                type: "string",
                description: "New category",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "New tags",
              },
              reprobeEndpoint: {
                type: "boolean",
                description: "Re-probe the endpoint to update probe data",
                default: false,
              },
              signature: {
                type: "string",
                description: "SIP-018 signature proving ownership (optional if payment is from owner)",
              },
              timestamp: {
                type: "number",
                description: "Unix timestamp (ms) for signature (required with signature)",
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
        description: "Update successful",
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

    const parsed = await this.parseJsonBody<{
      url?: string;
      owner?: string;
      name?: string;
      description?: string;
      category?: string;
      tags?: string[];
      reprobeEndpoint?: boolean;
      signature?: string;
      timestamp?: number;
    }>(c);
    if (parsed.error) return parsed.error;
    const body = parsed.body;

    if (!body.url) {
      return this.errorResponse(c, "url is required", 400);
    }

    // Resolve owner address
    const ownerResult = this.resolveOwnerAddress(c, body.owner);
    if (ownerResult.error) return ownerResult.error;
    const ownerAddress = ownerResult.address;

    // Look up the entry
    const entry = await getRegistryEntryByUrl(c.env.METRICS, body.url);

    if (!entry) {
      return this.errorResponse(c, "Endpoint not found in registry", 404);
    }

    // Verify ownership (address must match registered owner)
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

    // Authenticate via signature or payment
    const authResult = this.authenticateOwner(
      c,
      ownerAddress,
      body.signature,
      body.timestamp,
      "update-endpoint",
      { url: body.url, owner: ownerAddress }
    );
    if (!authResult.authenticated) return authResult.error;

    // Update fields if provided
    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return this.errorResponse(c, "name cannot be empty", 400);
      }
      if (body.name.length > 100) {
        return this.errorResponse(c, "name must be 100 characters or less", 400);
      }
      entry.name = body.name.trim();
    }

    if (body.description !== undefined) {
      if (body.description.trim().length === 0) {
        return this.errorResponse(c, "description cannot be empty", 400);
      }
      if (body.description.length > 500) {
        return this.errorResponse(c, "description must be 500 characters or less", 400);
      }
      entry.description = body.description.trim();
    }

    if (body.category !== undefined) {
      entry.category = body.category.toLowerCase().trim() || undefined;
    }

    if (body.tags !== undefined) {
      entry.tags = body.tags.map((t) => t.toLowerCase().trim());
    }

    // Re-probe if requested
    if (body.reprobeEndpoint) {
      const probeResult = await probeX402Endpoint(entry.url, { timeout: 15000 });
      if (probeResult.success && probeResult.data) {
        entry.probeData = probeResult.data;
      }
    }

    // Update timestamp
    entry.updatedAt = new Date().toISOString();

    // Save updated entry
    await saveRegistryEntry(c.env.METRICS, entry);

    return c.json({
      success: true,
      entry: {
        id: entry.id,
        url: entry.url,
        name: entry.name,
        description: entry.description,
        owner: entry.owner,
        status: entry.status,
        category: entry.category,
        tags: entry.tags,
        updatedAt: entry.updatedAt,
      },
      verifiedBy: authResult.method,
      tokenType,
    });
  }
}
