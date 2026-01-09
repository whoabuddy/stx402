import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class LinksCreate extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) Create a short link",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["url"],
            properties: {
              url: {
                type: "string" as const,
                description: "Target URL to shorten",
                format: "uri",
              },
              slug: {
                type: "string" as const,
                description: "Custom slug (3-32 chars, optional)",
                minLength: 3,
                maxLength: 32,
              },
              title: {
                type: "string" as const,
                description: "Optional title/description for the link",
                maxLength: 256,
              },
              ttl: {
                type: "number" as const,
                description: "Time to live in seconds (optional, no expiration if omitted)",
                minimum: 60,
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
        description: "Link created successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                slug: { type: "string" as const },
                shortUrl: { type: "string" as const },
                url: { type: "string" as const },
                title: { type: "string" as const, nullable: true },
                expiresAt: { type: "string" as const, nullable: true },
                createdAt: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: {
      url: string;
      slug?: string;
      title?: string;
      ttl?: number;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { url, slug, title, ttl } = body;

    if (!url || typeof url !== "string") {
      return this.errorResponse(c, "URL is required", 400);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return this.errorResponse(c, "Invalid URL format", 400);
    }

    // Validate slug if provided
    if (slug) {
      if (slug.length < 3 || slug.length > 32) {
        return this.errorResponse(c, "Slug must be 3-32 characters", 400);
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
        return this.errorResponse(c, "Slug can only contain letters, numbers, hyphens, and underscores", 400);
      }
    }

    // Validate title if provided
    if (title && title.length > 256) {
      return this.errorResponse(c, "Title must be 256 characters or less", 400);
    }

    // Validate TTL if provided
    if (ttl !== undefined && ttl < 60) {
      return this.errorResponse(c, "TTL must be at least 60 seconds", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      // If custom slug, check if it's globally unique first
      if (slug) {
        const existingOwner = await c.env.STORAGE.get(`link:slug:${slug}`);
        if (existingOwner && existingOwner !== payerAddress) {
          return this.errorResponse(c, "Slug is already taken", 400);
        }
      }

      const result = await stub.linkCreate(url, { slug, title, ttl });

      // Store global slug→owner mapping for the expand endpoint
      const kvKey = `link:slug:${result.slug}`;
      await c.env.STORAGE.put(kvKey, payerAddress, {
        // Set expiration if TTL is provided, otherwise keep forever
        ...(ttl ? { expirationTtl: ttl + 3600 } : {}), // Add 1 hour buffer
      });

      // Build short URL
      const baseUrl = new URL(c.req.url).origin;
      const shortUrl = `${baseUrl}/api/links/expand/${result.slug}`;

      return c.json({
        ...result,
        shortUrl,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Link create error", { error: String(error) });
      const message = error instanceof Error ? error.message : String(error);
      return this.errorResponse(c, message, 400);
    }
  }
}
