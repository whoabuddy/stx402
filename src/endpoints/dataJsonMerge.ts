import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataJsonMerge extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Deep merge multiple JSON objects",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["objects"],
            properties: {
              objects: {
                type: "array" as const,
                items: { type: "object" as const },
                minItems: 2,
                description: "Array of objects to merge (later objects override earlier)",
              },
              arrayStrategy: {
                type: "string" as const,
                enum: ["replace", "concat", "union"] as const,
                default: "replace",
                description: "How to handle array merging",
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
        description: "Merged object",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                merged: { type: "object" as const },
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

    let body: {
      objects?: unknown[];
      arrayStrategy?: "replace" | "concat" | "union";
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { objects, arrayStrategy = "replace" } = body;

    if (!Array.isArray(objects) || objects.length < 2) {
      return this.errorResponse(c, "objects must be an array with at least 2 items", 400);
    }

    // Validate all items are objects
    for (let i = 0; i < objects.length; i++) {
      if (typeof objects[i] !== "object" || objects[i] === null || Array.isArray(objects[i])) {
        return this.errorResponse(c, `Item at index ${i} must be an object`, 400);
      }
    }

    const merged = objects.reduce(
      (acc, obj) => this.deepMerge(acc as Record<string, unknown>, obj as Record<string, unknown>, arrayStrategy),
      {}
    );

    return c.json({
      merged,
      inputCount: objects.length,
      arrayStrategy,
      tokenType,
    });
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    arrayStrategy: "replace" | "concat" | "union"
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const targetVal = target[key];
      const sourceVal = source[key];

      if (Array.isArray(targetVal) && Array.isArray(sourceVal)) {
        switch (arrayStrategy) {
          case "concat":
            result[key] = [...targetVal, ...sourceVal];
            break;
          case "union":
            result[key] = [...new Set([...targetVal, ...sourceVal])];
            break;
          case "replace":
          default:
            result[key] = sourceVal;
        }
      } else if (
        typeof targetVal === "object" &&
        targetVal !== null &&
        !Array.isArray(targetVal) &&
        typeof sourceVal === "object" &&
        sourceVal !== null &&
        !Array.isArray(sourceVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
          arrayStrategy
        );
      } else {
        result[key] = sourceVal;
      }
    }

    return result;
  }
}
