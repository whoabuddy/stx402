import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntryByUrl,
  deleteRegistryEntry,
} from "../utils/registry";

export class RegistryDelete extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Delete a registered x402 endpoint (owner only, requires signature)",
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
                description: "The endpoint URL to delete",
              },
              owner: {
                type: "string",
                description: "Owner STX address (defaults to payer address, must match registered owner)",
              },
              signature: {
                type: "string",
                description: "SIP-018 signature of the delete challenge (required for deletion)",
              },
              challengeId: {
                type: "string",
                description: "Challenge ID from initial request (required with signature)",
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
        description: "Delete successful or challenge issued",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                deleted: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    url: { type: "string" },
                    name: { type: "string" },
                  },
                },
                challenge: {
                  type: "object",
                  description: "Signature challenge (when signature not provided)",
                  properties: {
                    challengeId: { type: "string" },
                    domain: { type: "string" },
                    message: { type: "string" },
                    action: { type: "string" },
                    expiresAt: { type: "number" },
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
      "403": {
        description: "Not authorized (not the owner or invalid signature)",
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
      signature?: string;
      challengeId?: string;
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

    // Verify ownership (address must match)
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

    // Authenticate with challenge-based signature
    const authResult = this.authenticateWithChallenge(
      c,
      ownerAddress,
      "delete-endpoint",
      { url: body.url, owner: ownerAddress },
      body.signature,
      body.challengeId
    );
    if (!authResult.authenticated) return authResult.error;

    // Signature verified - proceed with deletion
    const deletedInfo = {
      id: entry.id,
      url: entry.url,
      name: entry.name,
    };

    const deleted = await deleteRegistryEntry(c.env.METRICS, entry.owner, entry.id);

    if (!deleted) {
      return this.errorResponse(c, "Failed to delete entry", 500);
    }

    return c.json({
      success: true,
      deleted: deletedInfo,
      verifiedBy: "signature",
      tokenType,
    });
  }
}
