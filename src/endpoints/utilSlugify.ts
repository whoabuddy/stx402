import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilSlugify extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Generate URL-safe slugs with customization",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to slugify" },
              separator: { type: "string" as const, default: "-", description: "Word separator" },
              lowercase: { type: "boolean" as const, default: true },
              strict: { type: "boolean" as const, default: true, description: "Only allow a-z, 0-9, and separator" },
              maxLength: { type: "integer" as const, description: "Maximum slug length" },
              locale: { type: "string" as const, default: "en", description: "Locale for transliteration" },
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
        description: "Generated slug",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                slug: { type: "string" as const },
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

  // Common character replacements for transliteration
  private charMap: Record<string, string> = {
    à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a", æ: "ae",
    ç: "c", è: "e", é: "e", ê: "e", ë: "e",
    ì: "i", í: "i", î: "i", ï: "i",
    ñ: "n", ò: "o", ó: "o", ô: "o", õ: "o", ö: "o", ø: "o",
    ù: "u", ú: "u", û: "u", ü: "u", ý: "y", ÿ: "y",
    ß: "ss", œ: "oe", ð: "d", þ: "th",
    "€": "euro", "£": "pound", "$": "dollar", "¥": "yen",
    "©": "c", "®": "r", "™": "tm",
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: {
      text?: string;
      separator?: string;
      lowercase?: boolean;
      strict?: boolean;
      maxLength?: number;
      locale?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, separator = "-", lowercase = true, strict = true, maxLength } = body;

    if (typeof text !== "string" || text.trim().length === 0) {
      return this.errorResponse(c, "text field is required", 400);
    }

    let slug = text;

    // Transliterate special characters
    slug = slug
      .split("")
      .map((char) => this.charMap[char.toLowerCase()] || char)
      .join("");

    // Normalize unicode
    slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Convert to lowercase if requested
    if (lowercase) {
      slug = slug.toLowerCase();
    }

    // Replace spaces and non-alphanumeric with separator
    if (strict) {
      slug = slug.replace(/[^a-zA-Z0-9]+/g, separator);
    } else {
      slug = slug.replace(/[\s_]+/g, separator);
    }

    // Remove leading/trailing separators
    slug = slug.replace(new RegExp(`^${this.escapeRegex(separator)}+|${this.escapeRegex(separator)}+$`, "g"), "");

    // Collapse multiple separators
    slug = slug.replace(new RegExp(`${this.escapeRegex(separator)}+`, "g"), separator);

    // Apply max length
    if (maxLength && maxLength > 0 && slug.length > maxLength) {
      slug = slug.slice(0, maxLength);
      // Remove trailing separator after truncation
      slug = slug.replace(new RegExp(`${this.escapeRegex(separator)}+$`, "g"), "");
    }

    return c.json({
      original: text,
      slug,
      length: slug.length,
      separator,
      tokenType,
    });
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
