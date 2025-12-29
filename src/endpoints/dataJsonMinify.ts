import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataJsonMinify extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Minify JSON by removing whitespace",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["json"],
            properties: {
              json: { description: "JSON to minify (string or object)" },
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
        description: "Minified JSON",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                minified: { type: "string" as const },
                savings: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid JSON" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { json?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { json } = body;

    if (json === undefined) {
      return this.errorResponse(c, "json field is required", 400);
    }

    let parsed: unknown;
    const inputStr = typeof json === "string" ? json : JSON.stringify(json);

    try {
      parsed = typeof json === "string" ? JSON.parse(json) : json;
    } catch {
      return this.errorResponse(c, "Invalid JSON input", 400);
    }

    const minified = JSON.stringify(parsed);
    const savings = Math.round((1 - minified.length / inputStr.length) * 100 * 100) / 100;

    return c.json({
      minified,
      inputLength: inputStr.length,
      outputLength: minified.length,
      savings: savings > 0 ? savings : 0,
      savedBytes: inputStr.length - minified.length,
      tokenType,
    });
  }
}
