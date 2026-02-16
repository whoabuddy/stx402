import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { probeX402Endpoint } from "../utils/probe";
import {
  generateUrlHash,
  saveRegistryEntry,
  getRegistryEntryByUrl,
  type RegistryEntry,
} from "../utils/registry";
import { Address } from "@stacks/transactions";

export class RegistryRegister extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Register an x402 endpoint in the registry",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["url", "name", "description"],
            properties: {
              url: {
                type: "string",
                description: "The x402 endpoint URL to register",
              },
              name: {
                type: "string",
                description: "Display name for the endpoint",
              },
              description: {
                type: "string",
                description: "Description of what the endpoint does",
              },
              owner: {
                type: "string",
                description: "Owner STX address (defaults to payer address if not specified)",
              },
              category: {
                type: "string",
                description: "Category for filtering (e.g., 'ai', 'data', 'utility')",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags for discovery",
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
        description: "Registration successful",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                entry: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    url: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    owner: { type: "string" },
                    status: { type: "string" },
                    category: { type: "string" },
                    registeredAt: { type: "string" },
                  },
                },
                probeResult: { type: "object" },
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
      "409": {
        description: "Endpoint already registered",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const log = c.var.logger;

    log.info("Registry registration request", { tokenType });

    // Check if METRICS (KV) is configured - we use same KV for registry
    if (!c.env.METRICS) {
      log.error("Registry storage not configured");
      return this.errorResponse(c, "Registry storage not configured", 500);
    }

    const { body, error } = await this.parseJsonBody<{
      url?: string;
      name?: string;
      description?: string;
      owner?: string;
      category?: string;
      tags?: string[];
    }>(c);
    if (error) return error;

    // Validate required fields
    if (!body.url) {
      return this.errorResponse(c, "url is required", 400);
    }
    if (!body.name || body.name.trim().length === 0) {
      return this.errorResponse(c, "name is required", 400);
    }
    if (!body.description || body.description.trim().length === 0) {
      return this.errorResponse(c, "description is required", 400);
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return this.errorResponse(c, "Invalid URL format", 400);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return this.errorResponse(c, "URL must use http or https", 400);
    }

    // Validate owner address if provided, otherwise use payer address
    let ownerAddress: string;
    if (body.owner) {
      try {
        const addressObj = Address.parse(body.owner);
        ownerAddress = Address.stringify(addressObj);
      } catch {
        return this.errorResponse(c, "Invalid owner address format", 400);
      }
    } else {
      // Use payer address as owner when not explicitly specified
      const payerAddress = this.getPayerAddress(c);
      if (!payerAddress) {
        return this.errorResponse(c, "Could not determine owner from payment. Please specify owner address.", 400);
      }
      ownerAddress = payerAddress;
    }

    // Validate name length
    if (body.name.length > 100) {
      return this.errorResponse(c, "name must be 100 characters or less", 400);
    }

    // Validate description length
    if (body.description.length > 500) {
      return this.errorResponse(c, "description must be 500 characters or less", 400);
    }

    // Check if URL is already registered
    const existing = await getRegistryEntryByUrl(c.env.METRICS, body.url);
    if (existing) {
      log.warn("Endpoint already registered", { url: body.url, existingId: existing.id });
      return c.json(
        {
          error: "Endpoint already registered",
          existingEntry: {
            id: existing.id,
            owner: existing.owner,
            status: existing.status,
          },
          tokenType,
        },
        409
      );
    }

    // Probe the endpoint to validate it's a real x402 endpoint
    const probeResult = await probeX402Endpoint(body.url, { timeout: 15000 });

    if (!probeResult.success) {
      return this.errorResponse(
        c,
        `Failed to probe endpoint: ${probeResult.error}`,
        400
      );
    }

    // Generate URL hash for ID
    const urlHash = generateUrlHash(body.url);

    // Get registrant address from payment (the address that paid)
    // This may differ from owner if someone registers on behalf of another address
    const registeredBy = this.getPayerAddress(c) || ownerAddress;

    // Create the registry entry
    const now = new Date().toISOString();
    const entry: RegistryEntry = {
      id: urlHash,
      url: body.url,
      name: body.name.trim(),
      description: body.description.trim(),
      owner: ownerAddress,
      status: "unverified", // Auto-approve with unverified flag
      category: body.category?.toLowerCase().trim(),
      tags: body.tags?.map((t) => t.toLowerCase().trim()),
      probeData: probeResult.data,
      registeredAt: now,
      updatedAt: now,
      registeredBy,
    };

    // Save to KV
    await saveRegistryEntry(c.env.METRICS, entry);

    log.info("Registry entry created", {
      id: entry.id,
      url: entry.url,
      owner: entry.owner,
      registeredBy: entry.registeredBy,
    });

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
        registeredAt: entry.registeredAt,
      },
      probeResult: {
        isX402Endpoint: probeResult.isX402Endpoint,
        paymentAddress: probeResult.data?.paymentAddress,
        acceptedTokens: probeResult.data?.acceptedTokens,
        responseTimeMs: probeResult.data?.responseTimeMs,
      },
      tokenType,
    });
  }
}
