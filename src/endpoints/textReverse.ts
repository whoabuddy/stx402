import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextReverse extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Reverse text (characters or words)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to reverse" },
              mode: {
                type: "string" as const,
                enum: ["characters", "words", "lines"] as const,
                default: "characters",
                description: "Reverse mode",
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
        description: "Reversed text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                reversed: { type: "string" as const },
                mode: { type: "string" as const },
                length: { type: "integer" as const },
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

    let body: { text?: string; mode?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, mode = "characters" } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    const validModes = ["characters", "words", "lines"];
    if (!validModes.includes(mode)) {
      return this.errorResponse(c, `mode must be one of: ${validModes.join(", ")}`, 400);
    }

    let reversed: string;

    switch (mode) {
      case "characters":
        // Handle unicode properly with spread operator
        reversed = [...text].reverse().join("");
        break;
      case "words":
        reversed = text.split(/(\s+)/).reverse().join("");
        break;
      case "lines":
        reversed = text.split(/(\r?\n)/).reverse().join("");
        break;
      default:
        reversed = text;
    }

    return c.json({
      reversed,
      mode,
      length: text.length,
      tokenType,
    });
  }
}
