import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class LinksDelete extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) Delete a short link",
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
                description: "The short link slug to delete",
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
        description: "Link deleted",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                deleted: { type: "boolean" },
                slug: { type: "string" },
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

    const { body, error } = await this.parseJsonBody<{ slug: string }>(c);
    if (error) return error;

    const { slug } = body;

    if (!slug || typeof slug !== "string") {
      return this.errorResponse(c, "Slug is required", 400);
    }

    // Get user's Durable Object
    const stub = this.getUserDO(c, payerAddress);

    try {
      const result = await stub.linkDelete(slug);

      // Clean up global slug mapping
      const kvKey = `link:slug:${slug}`;
      await c.env.STORAGE.delete(kvKey);

      return c.json({ ...result, tokenType });
    } catch (error) {
      c.var.logger.error("Link delete error", { error: String(error) });
      return this.errorResponse(c, `Link operation failed: ${error}`, 500);
    }
  }
}
