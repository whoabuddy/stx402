import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataJsonFormat extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Format/prettify JSON",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["json"],
            properties: {
              json: { description: "JSON to format (string or object)" },
              indent: { type: "integer" as const, default: 2, description: "Indentation spaces" },
              sortKeys: { type: "boolean" as const, default: false, description: "Sort object keys alphabetically" },
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
        description: "Formatted JSON",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                formatted: { type: "string" as const },
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

    let body: { json?: unknown; indent?: number; sortKeys?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { json, indent = 2, sortKeys = false } = body;

    if (json === undefined) {
      return this.errorResponse(c, "json field is required", 400);
    }

    let parsed: unknown;
    try {
      parsed = typeof json === "string" ? JSON.parse(json) : json;
    } catch {
      return this.errorResponse(c, "Invalid JSON input", 400);
    }

    // Sort keys if requested
    const sortedObj = sortKeys ? this.sortObjectKeys(parsed) : parsed;
    const formatted = JSON.stringify(sortedObj, null, indent);

    return c.json({
      formatted,
      inputLength: typeof json === "string" ? json.length : JSON.stringify(json).length,
      outputLength: formatted.length,
      tokenType,
    });
  }

  private sortObjectKeys(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }
    if (obj !== null && typeof obj === "object") {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(obj as Record<string, unknown>).sort();
      for (const key of keys) {
        sorted[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key]);
      }
      return sorted;
    }
    return obj;
  }
}
