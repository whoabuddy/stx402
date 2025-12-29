import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataJsonPath extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Extract value from JSON using dot notation path",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["json", "path"],
            properties: {
              json: { description: "JSON to query (string or object)" },
              path: { type: "string" as const, description: "Dot notation path (e.g., 'user.name', 'items[0].id')" },
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
        description: "Extracted value",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                value: {},
                found: { type: "boolean" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid JSON or path" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { json?: unknown; path?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { json, path } = body;

    if (json === undefined) {
      return this.errorResponse(c, "json field is required", 400);
    }

    if (typeof path !== "string" || path.length === 0) {
      return this.errorResponse(c, "path field is required and must be a non-empty string", 400);
    }

    let parsed: unknown;
    try {
      parsed = typeof json === "string" ? JSON.parse(json) : json;
    } catch {
      return this.errorResponse(c, "Invalid JSON input", 400);
    }

    // Parse path and extract value
    const { value, found } = this.extractValue(parsed, path);

    return c.json({
      path,
      value,
      found,
      type: found ? (value === null ? "null" : Array.isArray(value) ? "array" : typeof value) : null,
      tokenType,
    });
  }

  private extractValue(obj: unknown, path: string): { value: unknown; found: boolean } {
    // Support both dot notation and bracket notation
    // e.g., "user.name", "items[0].id", "data['key with spaces']"

    const segments: string[] = [];
    let current = "";
    let inBracket = false;
    let bracketChar = "";

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (inBracket) {
        if (char === bracketChar || (bracketChar === "" && char === "]")) {
          if (char !== "]") i++; // Skip closing bracket
          inBracket = false;
          segments.push(current);
          current = "";
        } else {
          current += char;
        }
      } else if (char === "[") {
        if (current) {
          segments.push(current);
          current = "";
        }
        inBracket = true;
        bracketChar = path[i + 1] === "'" || path[i + 1] === '"' ? path[++i] : "";
      } else if (char === ".") {
        if (current) {
          segments.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      segments.push(current);
    }

    // Navigate to value
    let value: unknown = obj;
    for (const segment of segments) {
      if (value === null || value === undefined) {
        return { value: undefined, found: false };
      }

      if (typeof value !== "object") {
        return { value: undefined, found: false };
      }

      // Handle array index
      const index = parseInt(segment, 10);
      if (Array.isArray(value) && !isNaN(index)) {
        if (index < 0 || index >= value.length) {
          return { value: undefined, found: false };
        }
        value = value[index];
      } else if (segment in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[segment];
      } else {
        return { value: undefined, found: false };
      }
    }

    return { value, found: true };
  }
}
