import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class LinksList extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) List all your short links",
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
        description: "Links listed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                links: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      slug: { type: "string" as const },
                      url: { type: "string" as const },
                      title: { type: "string" as const, nullable: true },
                      clicks: { type: "number" as const },
                      expiresAt: { type: "string" as const, nullable: true },
                      createdAt: { type: "string" as const },
                    },
                  },
                },
                count: { type: "number" as const },
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

    // Get user's Durable Object
    const stub = this.getUserDO(c, payerAddress);

    try {
      const links = await stub.linkList();

      // Add shortUrl to each link
      const baseUrl = new URL(c.req.url).origin;
      const linksWithShortUrl = links.map((link) => ({
        ...link,
        shortUrl: `${baseUrl}/links/expand/${link.slug}`,
      }));

      return c.json({
        links: linksWithShortUrl,
        count: links.length,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Link list error", { error: String(error) });
      return this.errorResponse(c, `Link operation failed: ${error}`, 500);
    }
  }
}
