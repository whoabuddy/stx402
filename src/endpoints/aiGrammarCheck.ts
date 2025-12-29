import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class AiGrammarCheck extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Check grammar and suggest corrections",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to check" },
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
        description: "Grammar check result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                original: { type: "string" as const },
                corrected: { type: "string" as const },
                issues: { type: "array" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "500": { description: "AI processing error" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text } = body;

    if (typeof text !== "string" || text.trim().length === 0) {
      return this.errorResponse(c, "text field is required and must be a non-empty string", 400);
    }

    if (text.length > 3000) {
      return this.errorResponse(c, "text must be 3000 characters or less", 400);
    }

    try {
      const ai = c.env.AI;
      if (!ai) {
        return this.errorResponse(c, "AI service not configured", 500);
      }

      const prompt = `Check the following text for grammar, spelling, and punctuation errors. Respond with ONLY a JSON object containing:
- "corrected": the corrected version of the text
- "issues": an array of objects, each with "type" (grammar, spelling, punctuation), "original", "correction", and "explanation"
- "hasErrors": boolean indicating if any errors were found

Text:
"""
${text}
"""`;

      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "You are a grammar checking assistant. You only respond with valid JSON objects." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1500,
      });

      let responseText = "";
      if (typeof response === "object" && response !== null && "response" in response) {
        responseText = String((response as { response: string }).response);
      } else if (typeof response === "string") {
        responseText = response;
      }

      // Clean up response
      responseText = responseText.trim();
      if (responseText.startsWith("```json")) {
        responseText = responseText.slice(7);
      } else if (responseText.startsWith("```")) {
        responseText = responseText.slice(3);
      }
      if (responseText.endsWith("```")) {
        responseText = responseText.slice(0, -3);
      }
      responseText = responseText.trim();

      let result: {
        corrected: string;
        issues: Array<{ type: string; original: string; correction: string; explanation: string }>;
        hasErrors: boolean;
      };

      try {
        result = JSON.parse(responseText);
      } catch {
        result = {
          corrected: text,
          issues: [],
          hasErrors: false,
        };
      }

      return c.json({
        original: text,
        corrected: result.corrected || text,
        issues: result.issues || [],
        issueCount: (result.issues || []).length,
        hasErrors: result.hasErrors || false,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Grammar check failed: ${String(error)}`, 500);
    }
  }
}
