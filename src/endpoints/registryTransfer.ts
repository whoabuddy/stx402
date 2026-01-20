import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntryByUrl,
  saveRegistryEntry,
  deleteRegistryEntry,
  type RegistryEntry,
} from "../utils/registry";
import { Address } from "@stacks/transactions";

export class RegistryTransfer extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Transfer ownership of a registered endpoint (requires signature)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["url", "newOwner"],
            properties: {
              url: {
                type: "string" as const,
                description: "The endpoint URL to transfer",
              },
              owner: {
                type: "string" as const,
                description: "Current owner STX address (defaults to payer address)",
              },
              newOwner: {
                type: "string" as const,
                description: "New owner STX address to transfer to",
              },
              signature: {
                type: "string" as const,
                description: "SIP-018 signature of the transfer challenge",
              },
              challengeId: {
                type: "string" as const,
                description: "Challenge ID from initial request",
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
        description: "Transfer successful or challenge issued",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                entry: { type: "object" as const },
                challenge: { type: "object" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
      "403": { description: "Not authorized" },
      "404": { description: "Endpoint not found" },
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
      newOwner?: string;
      signature?: string;
      challengeId?: string;
    }>(c);
    if (parsed.error) return parsed.error;
    const body = parsed.body;

    if (!body.url) {
      return this.errorResponse(c, "url is required", 400);
    }
    if (!body.newOwner) {
      return this.errorResponse(c, "newOwner is required", 400);
    }

    // Resolve owner address
    const ownerResult = this.resolveOwnerAddress(c, body.owner);
    if (ownerResult.error) return ownerResult.error;
    const ownerAddress = ownerResult.address;

    // Validate new owner address
    let newOwnerAddress: string;
    try {
      const addressObj = Address.parse(body.newOwner);
      newOwnerAddress = Address.stringify(addressObj);
    } catch {
      return this.errorResponse(c, "Invalid newOwner address format", 400);
    }

    // Can't transfer to self
    if (ownerAddress === newOwnerAddress) {
      return this.errorResponse(c, "Cannot transfer to the same address", 400);
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

    // Authenticate with challenge-based signature
    const authResult = this.authenticateWithChallenge(
      c,
      ownerAddress,
      "transfer-ownership",
      { url: body.url, owner: ownerAddress, newOwner: newOwnerAddress },
      body.signature,
      body.challengeId
    );
    if (!authResult.authenticated) return authResult.error;

    // Transfer ownership
    // We need to delete the old entry and create a new one under the new owner
    // because the KV key includes the owner address
    const oldOwner = entry.owner;
    const oldId = entry.id;

    // Update entry with new owner
    const updatedEntry: RegistryEntry = {
      ...entry,
      owner: newOwnerAddress,
      updatedAt: new Date().toISOString(),
    };

    // Delete old entry
    await deleteRegistryEntry(c.env.METRICS, oldOwner, oldId);

    // Save under new owner
    await saveRegistryEntry(c.env.METRICS, updatedEntry);

    return c.json({
      success: true,
      transferred: {
        url: updatedEntry.url,
        name: updatedEntry.name,
        from: oldOwner,
        to: newOwnerAddress,
      },
      entry: {
        id: updatedEntry.id,
        url: updatedEntry.url,
        name: updatedEntry.name,
        owner: updatedEntry.owner,
        status: updatedEntry.status,
      },
      verifiedBy: "signature",
      tokenType,
    });
  }
}
