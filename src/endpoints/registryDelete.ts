import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntryByUrl,
  deleteRegistryEntry,
} from "../utils/registry";
import { Address } from "@stacks/transactions";
import {
  createSignatureRequest,
  verifyStructuredSignature,
  getDomain,
  createActionMessage,
  getChallenge,
  consumeChallenge,
  isTimestampValid,
} from "../utils/signatures";

export class RegistryDelete extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Delete a registered x402 endpoint (owner only, requires signature)",
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
              signature: {
                type: "string" as const,
                description: "SIP-018 signature of the delete challenge (required for deletion)",
              },
              challengeId: {
                type: "string" as const,
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
          type: "string" as const,
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
                challenge: {
                  type: "object" as const,
                  description: "Signature challenge (when signature not provided)",
                  properties: {
                    challengeId: { type: "string" as const },
                    domain: { type: "string" as const },
                    message: { type: "string" as const },
                    action: { type: "string" as const },
                    expiresAt: { type: "number" as const },
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
        description: "Not authorized (not the owner or invalid signature)",
      },
      "404": {
        description: "Endpoint not found",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = c.env.X402_NETWORK as "mainnet" | "testnet";

    if (!c.env.METRICS) {
      return this.errorResponse(c, "Registry storage not configured", 500);
    }

    let body: {
      url?: string;
      owner?: string;
      signature?: string;
      challengeId?: string;
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

    // If no signature provided, issue a challenge
    if (!body.signature) {
      const signatureRequest = createSignatureRequest(
        "delete-endpoint",
        { url: body.url, owner: ownerAddress },
        network,
        true // with challenge
      );

      return c.json({
        requiresSignature: true,
        message: "Delete operation requires a signed challenge. Sign the message and resubmit.",
        challenge: signatureRequest,
        tokenType,
      });
    }

    // Signature provided - verify it
    if (!body.challengeId) {
      return this.errorResponse(c, "challengeId is required when providing signature", 400);
    }

    // Get and validate the challenge
    const challenge = getChallenge(body.challengeId);
    if (!challenge) {
      return c.json(
        {
          error: "Challenge expired or invalid. Request a new challenge.",
          tokenType,
        },
        403
      );
    }

    // Verify challenge belongs to this owner
    if (challenge.owner !== ownerAddress) {
      return c.json(
        {
          error: "Challenge was issued for a different owner",
          tokenType,
        },
        403
      );
    }

    // Reconstruct the message that should have been signed
    // Must match the message from createSignatureRequest("delete-endpoint", ...)
    const domain = getDomain(network);
    const timestamp = challenge.expiresAt - 5 * 60 * 1000; // Original timestamp
    const message = createActionMessage("delete-endpoint", {
      url: body.url,
      owner: ownerAddress,
      timestamp,
    });

    // Verify the signature
    const verifyResult = verifyStructuredSignature(
      message,
      domain,
      body.signature,
      ownerAddress,
      network
    );

    if (!verifyResult.valid) {
      // Consume the challenge to prevent replay
      consumeChallenge(body.challengeId);

      return c.json(
        {
          error: "Invalid signature",
          details: verifyResult.error,
          recoveredAddress: verifyResult.recoveredAddress,
          expectedAddress: ownerAddress,
          tokenType,
        },
        403
      );
    }

    // Consume the challenge (one-time use)
    consumeChallenge(body.challengeId);

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
