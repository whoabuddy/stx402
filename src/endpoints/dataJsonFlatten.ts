import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataJsonFlatten extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Flatten nested JSON into dot notation keys",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["json"],
            properties: {
              json: { description: "JSON to flatten (string or object)" },
              delimiter: { type: "string" as const, default: ".", description: "Key delimiter" },
              maxDepth: { type: "integer" as const, description: "Maximum depth to flatten" },
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
        description: "Flattened JSON",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                flattened: { type: "object" as const },
                keyCount: { type: "integer" as const },
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

    let body: { json?: unknown; delimiter?: string; maxDepth?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { json, delimiter = ".", maxDepth } = body;

    if (json === undefined) {
      return this.errorResponse(c, "json field is required", 400);
    }

    let parsed: unknown;
    try {
      parsed = typeof json === "string" ? JSON.parse(json) : json;
    } catch {
      return this.errorResponse(c, "Invalid JSON input", 400);
    }

    if (typeof parsed !== "object" || parsed === null) {
      return this.errorResponse(c, "JSON must be an object or array", 400);
    }

    const flattened = this.flatten(parsed, delimiter, "", 0, maxDepth);

    return c.json({
      flattened,
      keyCount: Object.keys(flattened).length,
      delimiter,
      tokenType,
    });
  }

  private flatten(
    obj: unknown,
    delimiter: string,
    prefix: string,
    depth: number,
    maxDepth?: number
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (maxDepth !== undefined && depth >= maxDepth) {
      if (prefix) {
        result[prefix] = obj;
      }
      return result;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        if (prefix) result[prefix] = [];
      } else {
        for (let i = 0; i < obj.length; i++) {
          const newKey = prefix ? `${prefix}[${i}]` : `[${i}]`;
          const nested = this.flatten(obj[i], delimiter, newKey, depth + 1, maxDepth);
          Object.assign(result, nested);
        }
      }
    } else if (obj !== null && typeof obj === "object") {
      const keys = Object.keys(obj as Record<string, unknown>);
      if (keys.length === 0) {
        if (prefix) result[prefix] = {};
      } else {
        for (const key of keys) {
          const newKey = prefix ? `${prefix}${delimiter}${key}` : key;
          const nested = this.flatten(
            (obj as Record<string, unknown>)[key],
            delimiter,
            newKey,
            depth + 1,
            maxDepth
          );
          Object.assign(result, nested);
        }
      }
    } else {
      if (prefix) {
        result[prefix] = obj;
      }
    }

    return result;
  }
}
