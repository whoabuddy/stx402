import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextUnicodeInfo extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Get Unicode information for characters",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to analyze (1-100 characters)" },
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
        description: "Unicode information",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                characters: { type: "array" as const },
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

    if (typeof text !== "string" || text.length === 0) {
      return this.errorResponse(c, "text field is required", 400);
    }

    if ([...text].length > 100) {
      return this.errorResponse(c, "text must be 100 characters or less", 400);
    }

    const characters = [...text].map((char) => {
      const codePoint = char.codePointAt(0)!;
      const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
      const utf8Bytes = this.getUtf8Bytes(char);
      const utf16Units = this.getUtf16Units(char);

      return {
        character: char,
        codePoint,
        hex: `U+${hex}`,
        html: `&#${codePoint};`,
        htmlHex: `&#x${hex};`,
        utf8: utf8Bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" "),
        utf8Bytes: utf8Bytes.length,
        utf16: utf16Units.map((u) => u.toString(16).toUpperCase().padStart(4, "0")).join(" "),
        utf16Units: utf16Units.length,
        category: this.getCategory(codePoint),
        block: this.getBlock(codePoint),
      };
    });

    return c.json({
      text,
      length: text.length,
      codePointCount: [...text].length,
      byteLength: new TextEncoder().encode(text).length,
      characters,
      tokenType,
    });
  }

  private getUtf8Bytes(char: string): number[] {
    return [...new TextEncoder().encode(char)];
  }

  private getUtf16Units(char: string): number[] {
    const units: number[] = [];
    for (let i = 0; i < char.length; i++) {
      units.push(char.charCodeAt(i));
    }
    return units;
  }

  private getCategory(codePoint: number): string {
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return "Control";
    if (codePoint >= 0x30 && codePoint <= 0x39) return "Digit";
    if ((codePoint >= 0x41 && codePoint <= 0x5a) || (codePoint >= 0x61 && codePoint <= 0x7a)) return "Letter";
    if (codePoint === 0x20) return "Space";
    if (codePoint >= 0x21 && codePoint <= 0x2f) return "Punctuation";
    if (codePoint >= 0x3a && codePoint <= 0x40) return "Punctuation";
    if (codePoint >= 0x5b && codePoint <= 0x60) return "Punctuation";
    if (codePoint >= 0x7b && codePoint <= 0x7e) return "Punctuation";
    if (codePoint >= 0x1f600 && codePoint <= 0x1f64f) return "Emoji";
    if (codePoint >= 0x1f300 && codePoint <= 0x1f5ff) return "Emoji";
    if (codePoint >= 0x4e00 && codePoint <= 0x9fff) return "CJK";
    if (codePoint >= 0x3040 && codePoint <= 0x309f) return "Hiragana";
    if (codePoint >= 0x30a0 && codePoint <= 0x30ff) return "Katakana";
    if (codePoint >= 0x0400 && codePoint <= 0x04ff) return "Cyrillic";
    if (codePoint >= 0x0600 && codePoint <= 0x06ff) return "Arabic";
    return "Other";
  }

  private getBlock(codePoint: number): string {
    if (codePoint <= 0x7f) return "Basic Latin";
    if (codePoint <= 0xff) return "Latin-1 Supplement";
    if (codePoint <= 0x17f) return "Latin Extended-A";
    if (codePoint <= 0x24f) return "Latin Extended-B";
    if (codePoint >= 0x4e00 && codePoint <= 0x9fff) return "CJK Unified Ideographs";
    if (codePoint >= 0x1f600 && codePoint <= 0x1f64f) return "Emoticons";
    if (codePoint >= 0x1f300 && codePoint <= 0x1f5ff) return "Miscellaneous Symbols and Pictographs";
    return "Other";
  }
}
