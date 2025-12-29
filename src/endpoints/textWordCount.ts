import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextWordCount extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Count words, characters, and other text statistics",
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
        description: "Text statistics",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                words: { type: "integer" as const },
                characters: { type: "integer" as const },
                charactersNoSpaces: { type: "integer" as const },
                lines: { type: "integer" as const },
                sentences: { type: "integer" as const },
                paragraphs: { type: "integer" as const },
                readingTimeMinutes: { type: "number" as const },
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

    let body: { text?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    // Word count (split by whitespace, filter empty)
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;

    // Character counts
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, "").length;

    // Line count
    const lines = text.split(/\r?\n/).length;

    // Sentence count (split by . ! ? followed by space or end)
    const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0).length;

    // Paragraph count (double newlines)
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length || 1;

    // Reading time (average 200 words per minute)
    const readingTimeMinutes = Math.round((words / 200) * 10) / 10;

    return c.json({
      words,
      characters,
      charactersNoSpaces,
      lines,
      sentences,
      paragraphs,
      readingTimeMinutes,
      tokenType,
    });
  }
}
