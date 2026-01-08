import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class HashSha512 extends BaseEndpoint {
  schema = {
    tags: ["Hash"],
    summary: "(paid) Compute SHA-512 hash using SubtleCrypto",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: {
                type: "string" as const,
                description: "Text to hash",
              },
              encoding: {
                type: "string" as const,
                enum: ["hex", "base64"] as const,
                default: "hex",
                description: "Output encoding format",
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
        description: "SHA-512 hash",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                hash: { type: "string" as const },
                algorithm: { type: "string" as const },
                encoding: { type: "string" as const },
                inputLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string; encoding?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, encoding = "hex" } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    if (encoding !== "hex" && encoding !== "base64") {
      return this.errorResponse(c, "encoding must be 'hex' or 'base64'", 400);
    }

    // Encode text to UTF-8 bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Compute SHA-512 hash using SubtleCrypto
    const hashBuffer = await crypto.subtle.digest("SHA-512", data);
    const hashArray = new Uint8Array(hashBuffer);

    // Convert to requested encoding
    let hash: string;
    if (encoding === "hex") {
      hash = Array.from(hashArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } else {
      hash = btoa(String.fromCharCode(...hashArray));
    }

    return c.json({
      hash,
      algorithm: "SHA-512",
      encoding,
      inputLength: text.length,
      tokenType,
    });
  }
}
