import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

type CaseType = "upper" | "lower" | "title" | "sentence" | "camel" | "pascal" | "snake" | "kebab" | "constant";

export class TextCaseConvert extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Convert text case (upper, lower, camel, snake, etc.)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text", "case"],
            properties: {
              text: { type: "string" as const, description: "Text to convert" },
              case: {
                type: "string" as const,
                enum: ["upper", "lower", "title", "sentence", "camel", "pascal", "snake", "kebab", "constant"] as const,
                description: "Target case format",
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
        description: "Converted text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                converted: { type: "string" as const },
                originalCase: { type: "string" as const },
                targetCase: { type: "string" as const },
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

    let body: { text?: string; case?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, case: targetCase } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    const validCases: CaseType[] = ["upper", "lower", "title", "sentence", "camel", "pascal", "snake", "kebab", "constant"];
    if (!targetCase || !validCases.includes(targetCase as CaseType)) {
      return this.errorResponse(c, `case must be one of: ${validCases.join(", ")}`, 400);
    }

    // Split text into words
    const words = this.splitIntoWords(text);
    const converted = this.convertCase(words, targetCase as CaseType, text);

    return c.json({
      converted,
      targetCase,
      wordCount: words.length,
      tokenType,
    });
  }

  private splitIntoWords(text: string): string[] {
    // Handle camelCase/PascalCase
    let normalized = text.replace(/([a-z])([A-Z])/g, "$1 $2");
    // Handle snake_case and kebab-case
    normalized = normalized.replace(/[_-]/g, " ");
    // Split by spaces and filter empty
    return normalized.split(/\s+/).filter((w) => w.length > 0);
  }

  private convertCase(words: string[], targetCase: CaseType, originalText: string): string {
    switch (targetCase) {
      case "upper":
        return originalText.toUpperCase();
      case "lower":
        return originalText.toLowerCase();
      case "title":
        return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      case "sentence":
        return words
          .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
          .join(" ");
      case "camel":
        return words
          .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
          .join("");
      case "pascal":
        return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
      case "snake":
        return words.map((w) => w.toLowerCase()).join("_");
      case "kebab":
        return words.map((w) => w.toLowerCase()).join("-");
      case "constant":
        return words.map((w) => w.toUpperCase()).join("_");
      default:
        return originalText;
    }
  }
}
