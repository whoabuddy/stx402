import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

// Cloudflare AI translation model supports these language pairs
const SUPPORTED_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh",
  "ar", "hi", "tr", "vi", "th", "id", "cs", "da", "fi", "el", "he", "hu",
  "no", "ro", "sk", "sv", "uk", "bg", "ca", "hr", "et", "lv", "lt", "sl",
] as const;

type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

export class AiTranslate extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Translate text between languages using AI",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text", "target"],
            properties: {
              text: {
                type: "string" as const,
                description: "Text to translate",
                maxLength: 5000,
              },
              source: {
                type: "string" as const,
                description: "Source language code (auto-detect if omitted)",
              },
              target: {
                type: "string" as const,
                description: "Target language code (e.g., 'es', 'fr', 'de')",
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
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "Translated text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                translated: { type: "string" as const },
                source: { type: "string" as const },
                target: { type: "string" as const },
                originalLength: { type: "integer" as const },
                translatedLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input or unsupported language",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string; source?: string; target?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, source, target } = body;

    if (!text || typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    if (text.length > 5000) {
      return this.errorResponse(c, "text exceeds maximum length of 5000 characters", 400);
    }

    if (!target) {
      return this.errorResponse(c, "target language is required", 400);
    }

    const targetLower = target.toLowerCase() as LanguageCode;
    if (!SUPPORTED_LANGUAGES.includes(targetLower)) {
      return this.errorResponse(
        c,
        `Unsupported target language: ${target}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
        400
      );
    }

    if (source) {
      const sourceLower = source.toLowerCase() as LanguageCode;
      if (!SUPPORTED_LANGUAGES.includes(sourceLower)) {
        return this.errorResponse(
          c,
          `Unsupported source language: ${source}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
          400
        );
      }
    }

    try {
      // Use Cloudflare AI for translation via prompt
      const prompt = source
        ? `Translate the following text from ${source} to ${target}. Only output the translation, no explanations:\n\n${text}`
        : `Translate the following text to ${target}. Only output the translation, no explanations:\n\n${text}`;

      const result = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
        prompt,
        max_tokens: Math.min(text.length * 3, 4000), // Allow for expansion
        temperature: 0.3, // Lower temperature for more consistent translations
      });

      const translated = result.response.trim();

      return c.json({
        translated,
        source: source || "auto",
        target: targetLower,
        originalLength: text.length,
        translatedLength: translated.length,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Translation failed: ${String(error)}`, 500);
    }
  }
}
