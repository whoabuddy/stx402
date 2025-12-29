import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextHexEncode extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Encode text to hexadecimal",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to hex encode" },
              uppercase: {
                type: "boolean" as const,
                default: false,
                description: "Use uppercase hex characters",
              },
              prefix: {
                type: "boolean" as const,
                default: false,
                description: "Include 0x prefix",
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
        description: "Hex encoded text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                hex: { type: "string" as const },
                inputLength: { type: "integer" as const },
                byteLength: { type: "integer" as const },
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

    let body: { text?: string; uppercase?: boolean; prefix?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, uppercase = false, prefix = false } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    let hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (uppercase) {
      hex = hex.toUpperCase();
    }

    if (prefix) {
      hex = "0x" + hex;
    }

    return c.json({
      hex,
      inputLength: text.length,
      byteLength: bytes.length,
      tokenType,
    });
  }
}
