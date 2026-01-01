import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  getRegistryEntry,
  getRegistryEntryByUrl,
  saveRegistryEntry,
  generateUrlHash,
} from "../utils/registry";
import { probeX402Endpoint } from "../utils/probe";
import { Address } from "@stacks/transactions";
import {
  verifyStructuredSignature,
  getDomain,
  createActionMessage,
  isTimestampValid,
} from "../utils/signatures";
import { getPayerFromContext } from "../utils/payment";

export class RegistryUpdate extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Update a registered x402 endpoint (owner only, signature or payment auth)",
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
                description: "The endpoint URL to update",
              },
              owner: {
                type: "string" as const,
                description: "Owner STX address (must match registered owner)",
              },
              name: {
                type: "string" as const,
                description: "New display name",
              },
              description: {
                type: "string" as const,
                description: "New description",
              },
              category: {
                type: "string" as const,
                description: "New category",
              },
              tags: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "New tags",
              },
              reprobeEndpoint: {
                type: "boolean" as const,
                description: "Re-probe the endpoint to update probe data",
                default: false,
              },
              signature: {
                type: "string" as const,
                description: "SIP-018 signature proving ownership (optional if payment is from owner)",
              },
              timestamp: {
                type: "number" as const,
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
          type: "string" as const,
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
        description: "Not authorized (not the owner)",
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
      name?: string;
      description?: string;
      category?: string;
      tags?: string[];
      reprobeEndpoint?: boolean;
      signature?: string;
      timestamp?: number;
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

    // Dual authentication: signature OR payment from same address
    let authMethod: "signature" | "payment" | null = null;

    // Try signature auth first
    if (body.signature) {
      if (!body.timestamp) {
        return this.errorResponse(c, "timestamp is required when providing signature", 400);
      }

      if (!isTimestampValid(body.timestamp)) {
        return c.json(
          { error: "Timestamp expired or invalid. Must be within 5 minutes.", tokenType },
          403
        );
      }

      // Build the message that should have been signed
      const domain = getDomain(network);
      const message = createActionMessage("list-my-endpoints", {
        owner: ownerAddress,
        timestamp: body.timestamp,
      });

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

      authMethod = "signature";
    }

    // Try payment auth if no signature
    if (!authMethod) {
      const paymentResponseHeader = c.req.header("X-PAYMENT-RESPONSE");
      const paymentHeader = c.req.header("X-PAYMENT");

      const payerAddress = getPayerFromContext(paymentResponseHeader || null, paymentHeader || null);

      if (payerAddress && payerAddress === ownerAddress) {
        authMethod = "payment";
      }
    }

    // If no auth method succeeded, return error
    if (!authMethod) {
      return c.json(
        {
          error: "Authentication required - provide a signature OR pay from the owner address",
          owner: ownerAddress,
          hint: "Include a SIP-018 signature with timestamp, or ensure the X-PAYMENT is from the owner address",
          tokenType,
        },
        403
      );
    }

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
      verifiedBy: authMethod,
      tokenType,
    });
  }
}
