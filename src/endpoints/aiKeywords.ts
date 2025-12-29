import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class AiKeywords extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Extract keywords from text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to extract keywords from" },
              count: { type: "integer" as const, default: 10, description: "Maximum keywords to return" },
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
        description: "Extracted keywords",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                keywords: { type: "array" as const, items: { type: "string" as const } },
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

    let body: { text?: string; count?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, count = 10 } = body;

    if (typeof text !== "string" || text.trim().length === 0) {
      return this.errorResponse(c, "text field is required and must be a non-empty string", 400);
    }

    if (text.length > 10000) {
      return this.errorResponse(c, "text must be 10000 characters or less", 400);
    }

    try {
      const ai = c.env.AI;
      if (!ai) {
        return this.errorResponse(c, "AI service not configured", 500);
      }

      const prompt = `Extract the ${count} most important keywords or key phrases from the following text. Return ONLY a JSON array of strings, nothing else.

Text:
"""
${text}
"""`;

      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "You are a keyword extraction assistant. You only respond with valid JSON arrays of strings." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
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

      let keywords: string[];
      try {
        keywords = JSON.parse(responseText);
        if (!Array.isArray(keywords)) {
          throw new Error("Not an array");
        }
        keywords = keywords.filter((k) => typeof k === "string").slice(0, count);
      } catch {
        // Fallback: try to extract keywords from text
        keywords = responseText
          .split(/[,\n]/)
          .map((k) => k.trim().replace(/^["'\d.\s]+|["'\s]+$/g, ""))
          .filter((k) => k.length > 0)
          .slice(0, count);
      }

      return c.json({
        keywords,
        count: keywords.length,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Keyword extraction failed: ${String(error)}`, 500);
    }
  }
}
