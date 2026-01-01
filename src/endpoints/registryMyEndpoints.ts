import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { listEntriesByOwner } from "../utils/registry";
import { Address } from "@stacks/transactions";
import {
  createSignatureRequest,
  verifyStructuredSignature,
  getDomain,
  createActionMessage,
  isTimestampValid,
} from "../utils/signatures";
import { payerMatchesAddress, type ExtendedSettleResult } from "../utils/payment";

export class RegistryMyEndpoints extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) List all endpoints owned by an address (auth via signature or payment)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["owner"],
            properties: {
              owner: {
                type: "string" as const,
                description: "Owner STX address to list endpoints for",
              },
              signature: {
                type: "string" as const,
                description: "SIP-018 signature proving ownership (optional if paying from same address)",
              },
              timestamp: {
                type: "number" as const,
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
          type: "string" as const,
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
              type: "object" as const,
              properties: {
                entries: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      id: { type: "string" as const },
                      url: { type: "string" as const },
                      name: { type: "string" as const },
                      description: { type: "string" as const },
                      category: { type: "string" as const },
                      status: { type: "string" as const },
                      registeredAt: { type: "string" as const },
                    },
                  },
                },
                count: { type: "number" as const },
                authenticatedBy: { type: "string" as const },
                signatureRequest: {
                  type: "object" as const,
                  description: "Provided when signature is needed",
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
        description: "Not authorized (invalid signature or payment from different address)",
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
      owner?: string;
      signature?: string;
      timestamp?: number;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
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

    let authenticatedBy: "signature" | "payment" | null = null;

    // Try authentication method 1: Signature
    if (body.signature) {
      if (!body.timestamp) {
        return this.errorResponse(c, "timestamp is required when providing signature", 400);
      }

      // Validate timestamp is recent
      if (!isTimestampValid(body.timestamp)) {
        return c.json(
          {
            error: "Signature timestamp expired. Sign a fresh message.",
            tokenType,
          },
          403
        );
      }

      // Reconstruct the message that should have been signed
      const domain = getDomain(network);
      const message = createActionMessage("list-my-endpoints", {
        owner: ownerAddress,
        timestamp: body.timestamp,
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

      authenticatedBy = "signature";
    }

    // Try authentication method 2: Payment from same address
    if (!authenticatedBy) {
      // Get settle result and signed tx from context (set by middleware)
      const settleResult = c.get("settleResult") as ExtendedSettleResult | undefined;
      const signedTx = c.get("signedTx") as string | undefined;

      // Check if payer matches owner using hash160 comparison
      // This handles mainnet/testnet address format differences
      if (payerMatchesAddress(settleResult || null, signedTx || null, ownerAddress)) {
        authenticatedBy = "payment";
      }
    }

    // If not authenticated by either method, provide signature request
    if (!authenticatedBy) {
      const signatureRequest = createSignatureRequest(
        "list-my-endpoints",
        { owner: ownerAddress },
        network,
        false // no challenge needed for this operation
      );

      return c.json({
        error: "Authentication required",
        message: "Provide a signature or pay from the owner address",
        signatureRequest,
        instructions: {
          option1: "Sign the message with your wallet and include signature + timestamp",
          option2: "Pay for this request from the same address you want to list",
        },
        tokenType,
      });
    }

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
      authenticatedBy,
      tokenType,
    });
  }
}
