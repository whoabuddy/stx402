import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class HashHmac extends BaseEndpoint {
  schema = {
    tags: ["Hash"],
    summary: "(paid) Generate HMAC signature",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["message", "key"],
            properties: {
              message: { type: "string" as const, description: "Message to sign" },
              key: { type: "string" as const, description: "Secret key" },
              algorithm: {
                type: "string" as const,
                enum: ["SHA-256", "SHA-384", "SHA-512"] as const,
                default: "SHA-256",
                description: "Hash algorithm",
              },
              encoding: {
                type: "string" as const,
                enum: ["hex", "base64"] as const,
                default: "hex",
                description: "Output encoding",
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
        description: "HMAC signature",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                hmac: { type: "string" as const },
                algorithm: { type: "string" as const },
                encoding: { type: "string" as const },
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

    let body: { message?: string; key?: string; algorithm?: string; encoding?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { message, key, algorithm = "SHA-256", encoding = "hex" } = body;

    if (typeof message !== "string") {
      return this.errorResponse(c, "message field is required and must be a string", 400);
    }

    if (typeof key !== "string") {
      return this.errorResponse(c, "key field is required and must be a string", 400);
    }

    const validAlgorithms = ["SHA-256", "SHA-384", "SHA-512"];
    if (!validAlgorithms.includes(algorithm)) {
      return this.errorResponse(c, `algorithm must be one of: ${validAlgorithms.join(", ")}`, 400);
    }

    const validEncodings = ["hex", "base64"];
    if (!validEncodings.includes(encoding)) {
      return this.errorResponse(c, `encoding must be one of: ${validEncodings.join(", ")}`, 400);
    }

    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      const messageData = encoder.encode(message);

      // Import the key for HMAC
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: algorithm },
        false,
        ["sign"]
      );

      // Generate HMAC
      const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

      // Convert to desired encoding
      let hmac: string;
      if (encoding === "hex") {
        hmac = Array.from(new Uint8Array(signature))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } else {
        hmac = btoa(String.fromCharCode(...new Uint8Array(signature)));
      }

      return c.json({
        hmac,
        algorithm,
        encoding,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `HMAC generation failed: ${String(error)}`, 500);
    }
  }
}
