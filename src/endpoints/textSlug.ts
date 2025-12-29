import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextSlug extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Convert text to URL-friendly slug",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to convert to slug" },
              separator: {
                type: "string" as const,
                default: "-",
                description: "Word separator (default: hyphen)",
              },
              lowercase: {
                type: "boolean" as const,
                default: true,
                description: "Convert to lowercase",
              },
              maxLength: {
                type: "integer" as const,
                description: "Maximum slug length",
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
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "URL slug",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                slug: { type: "string" as const },
                originalLength: { type: "integer" as const },
                slugLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string; separator?: string; lowercase?: boolean; maxLength?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, separator = "-", lowercase = true, maxLength } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    // Normalize unicode characters (é → e, etc.)
    let slug = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Replace non-alphanumeric characters with separator
    slug = slug.replace(/[^a-zA-Z0-9]+/g, separator);

    // Remove leading/trailing separators
    slug = slug.replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");

    // Collapse multiple separators
    slug = slug.replace(new RegExp(`${separator}+`, "g"), separator);

    if (lowercase) {
      slug = slug.toLowerCase();
    }

    // Truncate if maxLength specified
    if (maxLength && maxLength > 0 && slug.length > maxLength) {
      slug = slug.slice(0, maxLength);
      // Remove trailing separator after truncation
      slug = slug.replace(new RegExp(`${separator}+$`, "g"), "");
    }

    return c.json({
      slug,
      originalLength: text.length,
      slugLength: slug.length,
      tokenType,
    });
  }
}
