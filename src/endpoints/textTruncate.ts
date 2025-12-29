import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextTruncate extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Truncate text to specified length",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text", "length"],
            properties: {
              text: { type: "string" as const, description: "Text to truncate" },
              length: { type: "integer" as const, description: "Maximum length" },
              suffix: {
                type: "string" as const,
                default: "...",
                description: "Suffix to append when truncated",
              },
              wordBoundary: {
                type: "boolean" as const,
                default: false,
                description: "Truncate at word boundary",
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
        description: "Truncated text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                truncated: { type: "string" as const },
                originalLength: { type: "integer" as const },
                truncatedLength: { type: "integer" as const },
                wasTruncated: { type: "boolean" as const },
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

    let body: { text?: string; length?: number; suffix?: string; wordBoundary?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, length, suffix = "...", wordBoundary = false } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    if (typeof length !== "number" || length < 1) {
      return this.errorResponse(c, "length must be a positive integer", 400);
    }

    const originalLength = text.length;

    // No truncation needed
    if (text.length <= length) {
      return c.json({
        truncated: text,
        originalLength,
        truncatedLength: text.length,
        wasTruncated: false,
        tokenType,
      });
    }

    // Calculate max content length (accounting for suffix)
    const maxContentLength = length - suffix.length;

    if (maxContentLength <= 0) {
      return c.json({
        truncated: suffix.slice(0, length),
        originalLength,
        truncatedLength: Math.min(suffix.length, length),
        wasTruncated: true,
        tokenType,
      });
    }

    let truncated = text.slice(0, maxContentLength);

    if (wordBoundary) {
      // Find last space before maxContentLength
      const lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 0) {
        truncated = truncated.slice(0, lastSpace);
      }
    }

    // Remove trailing whitespace and punctuation before suffix
    truncated = truncated.replace(/[\s.,!?;:]+$/, "");
    truncated += suffix;

    return c.json({
      truncated,
      originalLength,
      truncatedLength: truncated.length,
      wasTruncated: true,
      tokenType,
    });
  }
}
