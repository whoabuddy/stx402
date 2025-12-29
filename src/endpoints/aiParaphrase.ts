import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class AiParaphrase extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Paraphrase text in different styles",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to paraphrase" },
              style: {
                type: "string" as const,
                enum: ["formal", "casual", "simple", "academic", "creative"] as const,
                default: "simple",
                description: "Target style",
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
        description: "Paraphrased text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                original: { type: "string" as const },
                paraphrased: { type: "string" as const },
                style: { type: "string" as const },
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

    let body: { text?: string; style?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, style = "simple" } = body;

    if (typeof text !== "string" || text.trim().length === 0) {
      return this.errorResponse(c, "text field is required and must be a non-empty string", 400);
    }

    if (text.length > 3000) {
      return this.errorResponse(c, "text must be 3000 characters or less", 400);
    }

    const validStyles = ["formal", "casual", "simple", "academic", "creative"];
    if (!validStyles.includes(style)) {
      return this.errorResponse(c, `style must be one of: ${validStyles.join(", ")}`, 400);
    }

    const styleInstructions: Record<string, string> = {
      formal: "Use formal, professional language suitable for business communication.",
      casual: "Use casual, conversational language as if speaking to a friend.",
      simple: "Use simple, easy-to-understand language with short sentences.",
      academic: "Use academic language with precise terminology.",
      creative: "Use creative, engaging language with vivid descriptions.",
    };

    try {
      const ai = c.env.AI;
      if (!ai) {
        return this.errorResponse(c, "AI service not configured", 500);
      }

      const prompt = `Paraphrase the following text. ${styleInstructions[style]} Keep the core meaning intact but express it differently. Return ONLY the paraphrased text, nothing else.

Text:
"""
${text}
"""`;

      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "You are a paraphrasing assistant. Respond only with the paraphrased text." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
      });

      let paraphrased = "";
      if (typeof response === "object" && response !== null && "response" in response) {
        paraphrased = String((response as { response: string }).response).trim();
      } else if (typeof response === "string") {
        paraphrased = response.trim();
      }

      return c.json({
        original: text,
        paraphrased,
        style,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Paraphrasing failed: ${String(error)}`, 500);
    }
  }
}
