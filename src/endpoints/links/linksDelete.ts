import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import type { UserDurableObject } from "../../durable-objects/UserDurableObject";

export class LinksDelete extends BaseEndpoint {
  schema = {
    tags: ["Links"],
    summary: "(paid) Delete a short link",
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
          type: "string" as const,
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
              type: "object" as const,
              properties: {
                deleted: { type: "boolean" as const },
                slug: { type: "string" as const },
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
      const result = await stub.linkDelete(slug);

      // Clean up global slug mapping
      const kvKey = `link:slug:${slug}`;
      await c.env.STORAGE.delete(kvKey);

      return c.json({ ...result, tokenType });
    } catch (error) {
      console.error("Link delete error:", error);
      return this.errorResponse(c, `Link operation failed: ${error}`, 500);
    }
  }
}
