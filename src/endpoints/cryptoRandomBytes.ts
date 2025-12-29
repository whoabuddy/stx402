import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class CryptoRandomBytes extends BaseEndpoint {
  schema = {
    tags: ["Crypto"],
    summary: "(paid) Generate cryptographically secure random bytes",
    parameters: [
      {
        name: "length",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 32, minimum: 1, maximum: 1024 },
        description: "Number of random bytes to generate",
      },
      {
        name: "format",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["hex", "base64"] as const, default: "hex" },
        description: "Output format",
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "Random bytes",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                bytes: { type: "string" as const },
                length: { type: "integer" as const },
                format: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid parameters" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const length = Math.min(1024, Math.max(1, parseInt(c.req.query("length") || "32", 10)));
    const format = c.req.query("format") || "hex";

    if (!["hex", "base64"].includes(format)) {
      return this.errorResponse(c, "format must be 'hex' or 'base64'", 400);
    }

    // Generate random bytes using Web Crypto API
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);

    let output: string;
    if (format === "hex") {
      output = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } else {
      // Base64 encode
      output = btoa(String.fromCharCode(...randomBytes));
    }

    return c.json({
      bytes: output,
      length,
      format,
      bits: length * 8,
      tokenType,
    });
  }
}
