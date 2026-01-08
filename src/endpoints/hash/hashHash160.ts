import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { bytesToHex } from "@noble/hashes/utils";
import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class HashHash160 extends BaseEndpoint {
  schema = {
    tags: ["Hash"],
    summary: "(paid) Compute Hash160: RIPEMD160(SHA256(x)) - Bitcoin/Clarity compatible",
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
        description: "Hash160 result",
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

    // Compute Hash160: RIPEMD160(SHA256(data))
    const sha256Hash = sha256(data);
    const hashArray = ripemd160(sha256Hash);

    // Convert to requested encoding
    let hash: string;
    if (encoding === "hex") {
      hash = bytesToHex(hashArray);
    } else {
      hash = btoa(String.fromCharCode(...hashArray));
    }

    return c.json({
      hash,
      algorithm: "Hash160 (RIPEMD160(SHA256(x)))",
      encoding,
      inputLength: text.length,
      tokenType,
    });
  }
}
