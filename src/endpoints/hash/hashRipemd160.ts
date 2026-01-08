import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { bytesToHex } from "@noble/hashes/utils";

export class HashRipemd160 extends BaseEndpoint {
  schema = {
    tags: ["Hash"],
    summary: "(paid) Generate RIPEMD-160 hash",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["data"],
            properties: {
              data: { type: "string" as const, description: "Data to hash" },
              encoding: {
                type: "string" as const,
                enum: ["utf8", "hex"] as const,
                default: "utf8",
                description: "Input encoding",
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
        description: "RIPEMD-160 hash result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                hash: { type: "string" as const },
                algorithm: { type: "string" as const },
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

    let body: { data?: string; encoding?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { data, encoding = "utf8" } = body;

    if (typeof data !== "string") {
      return this.errorResponse(c, "data field is required and must be a string", 400);
    }

    let inputBytes: Uint8Array;

    if (encoding === "hex") {
      if (!/^[0-9a-fA-F]*$/.test(data)) {
        return this.errorResponse(c, "Invalid hex string", 400);
      }
      if (data.length % 2 !== 0) {
        return this.errorResponse(c, "Hex string must have even length", 400);
      }
      inputBytes = new Uint8Array(data.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
    } else {
      inputBytes = new TextEncoder().encode(data);
    }

    const hash = ripemd160(inputBytes);
    const hashHex = bytesToHex(hash);

    return c.json({
      hash: hashHex,
      algorithm: "ripemd160",
      inputLength: inputBytes.length,
      outputBits: 160,
      tokenType,
    });
  }
}
