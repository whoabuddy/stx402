import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class LinksStats extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) Get link click statistics",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["slug"],
            properties: {
              slug: {
                type: "string" as const,
                description: "The short link slug",
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
        description: "Link statistics retrieved",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                slug: { type: "string" as const },
                url: { type: "string" as const },
                title: { type: "string" as const, nullable: true },
                clicks: { type: "number" as const },
                createdAt: { type: "string" as const },
                lastClickAt: { type: "string" as const, nullable: true },
                referrers: {
                  type: "object" as const,
                  additionalProperties: { type: "number" as const },
                },
                recentClicks: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      clickedAt: { type: "string" as const },
                      referrer: { type: "string" as const, nullable: true },
                      country: { type: "string" as const, nullable: true },
                    },
                  },
                },
                tokenType: { type: "string" as const },
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

    let body: { slug: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { slug } = body;

    if (!slug || typeof slug !== "string") {
      return this.errorResponse(c, "Slug is required", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const stats = await stub.linkStats(slug);

      if (!stats) {
        return this.errorResponse(c, `Link '${slug}' not found`, 404);
      }

      return c.json({ ...stats, tokenType });
    } catch (error) {
      c.var.logger.error("Link stats error", { error: String(error) });
      return this.errorResponse(c, `Link operation failed: ${error}`, 500);
    }
  }
}
