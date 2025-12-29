import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextRegexTest extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Test text against a regular expression",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text", "pattern"],
            properties: {
              text: { type: "string" as const, description: "Text to test" },
              pattern: { type: "string" as const, description: "Regular expression pattern" },
              flags: {
                type: "string" as const,
                default: "",
                description: "Regex flags (g, i, m, s, u)",
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
        description: "Regex test result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                matches: { type: "boolean" as const },
                matchCount: { type: "integer" as const },
                allMatches: { type: "array" as const, items: { type: "string" as const } },
                groups: { type: "array" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input or pattern" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string; pattern?: string; flags?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, pattern, flags = "" } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    if (typeof pattern !== "string" || pattern.length === 0) {
      return this.errorResponse(c, "pattern field is required and must be a non-empty string", 400);
    }

    // Validate flags
    const validFlags = "gimsuy";
    for (const flag of flags) {
      if (!validFlags.includes(flag)) {
        return this.errorResponse(c, `Invalid regex flag: ${flag}. Valid flags: ${validFlags}`, 400);
      }
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flags);
    } catch (error) {
      return this.errorResponse(c, `Invalid regex pattern: ${String(error)}`, 400);
    }

    // Test for basic match
    const matches = regex.test(text);

    // Find all matches
    const allMatches: string[] = [];
    const groups: Array<{ match: string; groups: string[] | null; index: number }> = [];

    // Reset lastIndex for global regex
    regex.lastIndex = 0;

    if (flags.includes("g")) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        allMatches.push(match[0]);
        groups.push({
          match: match[0],
          groups: match.slice(1).length > 0 ? match.slice(1) : null,
          index: match.index,
        });
        // Prevent infinite loop on zero-width matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } else {
      const match = regex.exec(text);
      if (match) {
        allMatches.push(match[0]);
        groups.push({
          match: match[0],
          groups: match.slice(1).length > 0 ? match.slice(1) : null,
          index: match.index,
        });
      }
    }

    return c.json({
      matches,
      matchCount: allMatches.length,
      allMatches,
      groups: groups.length > 0 ? groups : null,
      pattern,
      flags: flags || null,
      tokenType,
    });
  }
}
