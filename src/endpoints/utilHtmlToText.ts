import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilHtmlToText extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Convert HTML to plain text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["html"],
            properties: {
              html: { type: "string" as const, description: "HTML to convert" },
              preserveLinks: { type: "boolean" as const, default: false, description: "Preserve link URLs in output" },
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
        description: "Plain text output",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                text: { type: "string" as const },
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

    let body: { html?: string; preserveLinks?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { html, preserveLinks = false } = body;

    if (typeof html !== "string") {
      return this.errorResponse(c, "html field is required and must be a string", 400);
    }

    let text = html;

    // Remove script and style tags with content
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Handle links
    if (preserveLinks) {
      text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, "$2 ($1)");
    }

    // Add line breaks for block elements
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<\/div>/gi, "\n");
    text = text.replace(/<\/h[1-6]>/gi, "\n\n");
    text = text.replace(/<\/li>/gi, "\n");
    text = text.replace(/<\/tr>/gi, "\n");
    text = text.replace(/<hr\s*\/?>/gi, "\n---\n");

    // Handle list items
    text = text.replace(/<li[^>]*>/gi, "• ");

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    const entities: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&apos;": "'",
      "&nbsp;": " ",
      "&ndash;": "–",
      "&mdash;": "—",
      "&copy;": "©",
      "&reg;": "®",
      "&trade;": "™",
    };

    for (const [entity, char] of Object.entries(entities)) {
      text = text.split(entity).join(char);
    }

    // Decode numeric entities
    text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Clean up whitespace
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
    text = text.trim();

    return c.json({
      text,
      inputLength: html.length,
      outputLength: text.length,
      tokenType,
    });
  }
}
