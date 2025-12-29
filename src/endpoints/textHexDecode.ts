import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextHexDecode extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Decode hexadecimal to text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["hex"],
            properties: {
              hex: { type: "string" as const, description: "Hex string to decode (with or without 0x prefix)" },
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
        description: "Decoded text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                text: { type: "string" as const },
                byteLength: { type: "integer" as const },
                outputLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid hex string" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { hex?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { hex } = body;

    if (typeof hex !== "string") {
      return this.errorResponse(c, "hex field is required and must be a string", 400);
    }

    // Remove 0x prefix if present
    let cleanHex = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;

    // Remove any whitespace
    cleanHex = cleanHex.replace(/\s/g, "");

    // Validate hex string
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      return this.errorResponse(c, "Invalid hex string: contains non-hex characters", 400);
    }

    if (cleanHex.length % 2 !== 0) {
      return this.errorResponse(c, "Invalid hex string: must have even number of characters", 400);
    }

    try {
      const bytes = new Uint8Array(cleanHex.length / 2);
      for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
      }

      const decoder = new TextDecoder("utf-8", { fatal: true });
      const text = decoder.decode(bytes);

      return c.json({
        text,
        byteLength: bytes.length,
        outputLength: text.length,
        tokenType,
      });
    } catch {
      return this.errorResponse(c, "Invalid hex string: cannot decode as UTF-8 text", 400);
    }
  }
}
