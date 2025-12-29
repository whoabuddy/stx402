import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class AiQuestionAnswer extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Answer a question based on provided context",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["context", "question"],
            properties: {
              context: { type: "string" as const, description: "Context text to answer from" },
              question: { type: "string" as const, description: "Question to answer" },
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
        description: "Answer to the question",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                question: { type: "string" as const },
                answer: { type: "string" as const },
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

    let body: { context?: string; question?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { context, question } = body;

    if (typeof context !== "string" || context.trim().length === 0) {
      return this.errorResponse(c, "context field is required and must be a non-empty string", 400);
    }

    if (typeof question !== "string" || question.trim().length === 0) {
      return this.errorResponse(c, "question field is required and must be a non-empty string", 400);
    }

    if (context.length > 8000) {
      return this.errorResponse(c, "context must be 8000 characters or less", 400);
    }

    if (question.length > 500) {
      return this.errorResponse(c, "question must be 500 characters or less", 400);
    }

    try {
      const ai = c.env.AI;
      if (!ai) {
        return this.errorResponse(c, "AI service not configured", 500);
      }

      const prompt = `Based ONLY on the following context, answer the question. If the answer cannot be found in the context, say "The answer is not found in the provided context."

Respond with ONLY a JSON object containing:
- "answer": your answer to the question
- "confidence": a number from 0 to 1 indicating how confident you are (1 = answer clearly in context, 0 = answer not in context)
- "foundInContext": boolean

Context:
"""
${context}
"""

Question: ${question}`;

      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "You are a question-answering assistant. Answer questions based only on the provided context. Respond with valid JSON objects." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
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

      let result: { answer: string; confidence: number; foundInContext: boolean };
      try {
        result = JSON.parse(responseText);
      } catch {
        // If JSON parsing fails, use the raw response as the answer
        result = {
          answer: responseText,
          confidence: 0.5,
          foundInContext: true,
        };
      }

      return c.json({
        question,
        answer: result.answer,
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        foundInContext: result.foundInContext !== false,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Question answering failed: ${String(error)}`, 500);
    }
  }
}
