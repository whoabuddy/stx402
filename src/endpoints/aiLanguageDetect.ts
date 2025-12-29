import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class AiLanguageDetect extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Detect the language of text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to analyze" },
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
        description: "Detected language",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                language: { type: "string" as const },
                code: { type: "string" as const },
                confidence: { type: "number" as const },
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

    if (text.length > 5000) {
      return this.errorResponse(c, "text must be 5000 characters or less", 400);
    }

    try {
      const ai = c.env.AI;
      if (!ai) {
        return this.errorResponse(c, "AI service not configured", 500);
      }

      const prompt = `Identify the language of the following text. Respond with ONLY a JSON object containing:
- "language": the full name of the language (e.g., "English", "Spanish", "Japanese")
- "code": the ISO 639-1 two-letter code (e.g., "en", "es", "ja")
- "confidence": a number from 0 to 1 indicating confidence

Text:
"""
${text.slice(0, 1000)}
"""`;

      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "You are a language detection assistant. You only respond with valid JSON objects." },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
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

      let result: { language: string; code: string; confidence: number };
      try {
        result = JSON.parse(responseText);
      } catch {
        // Default fallback
        result = { language: "Unknown", code: "und", confidence: 0 };
      }

      return c.json({
        language: result.language || "Unknown",
        code: result.code || "und",
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Language detection failed: ${String(error)}`, 500);
    }
  }
}
