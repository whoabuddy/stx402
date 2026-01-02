import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import type { UserDurableObject } from "../../durable-objects/UserDurableObject";

export class LinksExpand extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) Expand/resolve a short link",
    parameters: [
      {
        name: "slug",
        in: "path" as const,
        required: true,
        schema: {
          type: "string" as const,
          description: "The short link slug",
        },
      },
      {
        name: "redirect",
        in: "query" as const,
        required: false,
        schema: {
          type: "boolean" as const,
          description: "If true, return 302 redirect instead of JSON",
          default: false,
        },
      },
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
        description: "Link expanded successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                slug: { type: "string" as const },
                url: { type: "string" as const },
                title: { type: "string" as const, nullable: true },
                clicks: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "302": { description: "Redirect to target URL (if redirect=true)" },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
      "404": { description: "Link not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    const slug = c.req.param("slug");
    const shouldRedirect = c.req.query("redirect") === "true";

    if (!slug) {
      return this.errorResponse(c, "Slug is required", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const link = await stub.linkGet(slug);

      if (!link) {
        return this.errorResponse(c, `Link '${slug}' not found or expired`, 404);
      }

      // Record the click with metadata
      const referrer = c.req.header("Referer") || c.req.header("Referrer");
      const userAgent = c.req.header("User-Agent");
      const country = c.req.header("CF-IPCountry");

      await stub.linkRecordClick(slug, { referrer, userAgent, country });

      // If redirect requested, return 302
      if (shouldRedirect) {
        return c.redirect(link.url, 302);
      }

      // Otherwise return JSON
      return c.json({
        slug: link.slug,
        url: link.url,
        title: link.title,
        clicks: link.clicks + 1, // Include this click
        tokenType,
      });
    } catch (error) {
      console.error("Link expand error:", error);
      return this.errorResponse(c, `Link operation failed: ${error}`, 500);
    }
  }
}
