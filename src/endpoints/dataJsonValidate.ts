import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataJsonValidate extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Validate JSON syntax",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["json"],
            properties: {
              json: { type: "string" as const, description: "JSON string to validate" },
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
        description: "Validation result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                valid: { type: "boolean" as const },
                error: { type: "string" as const, nullable: true },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { json?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { json } = body;

    if (typeof json !== "string") {
      return this.errorResponse(c, "json field must be a string", 400);
    }

    try {
      const parsed = JSON.parse(json);
      const type = Array.isArray(parsed) ? "array" : typeof parsed;

      return c.json({
        valid: true,
        error: null,
        type,
        length: json.length,
        ...(type === "array" ? { arrayLength: parsed.length } : {}),
        ...(type === "object" ? { keyCount: Object.keys(parsed).length } : {}),
        tokenType,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Try to extract position from error message
      let position: number | null = null;
      const posMatch = errorMessage.match(/position (\d+)/i);
      if (posMatch) {
        position = parseInt(posMatch[1], 10);
      }

      return c.json({
        valid: false,
        error: errorMessage,
        position,
        length: json.length,
        tokenType,
      });
    }
  }
}
