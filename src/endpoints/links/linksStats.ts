import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { TOKEN_TYPE_PARAM } from "../../utils/schema-helpers";

export class LinksStats extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) Get link click statistics",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["slug"],
            properties: {
              slug: {
                type: "string",
                description: "The short link slug",
              },
            },
          },
        },
      },
    },
    parameters: [TOKEN_TYPE_PARAM],
    responses: {
      "200": {
        description: "Link statistics retrieved",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                slug: { type: "string" },
                url: { type: "string" },
                title: { type: "string", nullable: true },
                clicks: { type: "number" },
                createdAt: { type: "string" },
                lastClickAt: { type: "string", nullable: true },
                referrers: {
                  type: "object",
                  additionalProperties: { type: "number" },
                },
                recentClicks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      clickedAt: { type: "string" },
                      referrer: { type: "string", nullable: true },
                      country: { type: "string", nullable: true },
                    },
                  },
                },
                tokenType: { type: "string" },
              },
            },
          },
        },
      },
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

    const { body, error } = await this.parseJsonBody<{ slug: string }>(c);
    if (error) return error;

    const { slug } = body;

    if (!slug || typeof slug !== "string") {
      return this.errorResponse(c, "Slug is required", 400);
    }

    // Get user's Durable Object
    const stub = this.getUserDO(c, payerAddress);

    try {
      const stats = await stub.linkStats(slug);

      if (!stats) {
        return this.errorResponse(c, `Link '${slug}' not found`, 404);
      }

      return c.json({ ...stats, tokenType });
    } catch (error) {
      c.var.logger.error("Link stats error", { error: String(error) });
      return this.errorResponse(c, `Link operation failed: ${String(error)}`, 500);
    }
  }
}
