import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { TOKEN_TYPE_PARAM } from "../../utils/schema-helpers";

export class LinksList extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) List all your short links",
    parameters: [TOKEN_TYPE_PARAM],
    responses: {
      "200": {
        description: "Links listed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                links: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      slug: { type: "string" },
                      url: { type: "string" },
                      title: { type: "string", nullable: true },
                      clicks: { type: "number" },
                      expiresAt: { type: "string", nullable: true },
                      createdAt: { type: "string" },
                    },
                  },
                },
                count: { type: "number" },
                tokenType: { type: "string" },
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
      return this.errorResponse(c, `Link operation failed: ${String(error)}`, 500);
    }
  }
}
