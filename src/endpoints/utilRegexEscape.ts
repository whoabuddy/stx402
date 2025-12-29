import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilRegexEscape extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Escape special regex characters in a string",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to escape for use in regex" },
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
        description: "Escaped regex string",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                original: { type: "string" as const },
                escaped: { type: "string" as const },
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

    let body: { text?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    // Escape all special regex characters
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Count special characters that were escaped
    const specialChars = text.match(/[.*+?^${}()|[\]\\]/g) || [];

    return c.json({
      original: text,
      escaped,
      escapedCount: specialChars.length,
      specialCharacters: [...new Set(specialChars)],
      tokenType,
    });
  }
}
