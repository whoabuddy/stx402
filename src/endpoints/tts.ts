import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class Tts extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Generate speech from text using TTS AI (English/Spanish)",
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        } as const,
      },
      {
        name: "lang",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["en", "es"] as const,
          default: "en",
        } as const,
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              text: {
                type: "string" as const,
                description: "Text to synthesize",
              } as const,
              speaker: {
                type: "string" as const,
                description: "Voice speaker (e.g., 'angus' for en, 'sirio' for es)",
              } as const,
            } as const,
            required: ["text"] as const,
          } as const,
        },
      },
    },
    responses: {
      "200": {
        description: "Generated audio",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                audio: { type: "string" as const, description: "Base64 encoded audio" } as const,
                tokenType: {
                  type: "string" as const,
                  enum: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
      "400": {
        description: "Invalid input",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                error: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  enum: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
      "402": {
        description: "Payment required",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                maxAmountRequired: { type: "string" as const } as const,
                resource: { type: "string" as const } as const,
                payTo: { type: "string" as const } as const,
                network: {
                  type: "string" as const,
                  enum: ["mainnet", "testnet"] as const,
                } as const,
                nonce: { type: "string" as const } as const,
                expiresAt: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  enum: ["STX", "sBTC", "USDCx"] as const,
                },
              } as const,
            } as const,
          } as const,
        } as const,
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                error: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  enum: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const lang = (c.req.query("lang") || "en") as "en" | "es";

    let body;
    try {
      body = await c.req.json<{ text: string; speaker?: string }>();
      if (!body.text || typeof body.text !== "string") {
        return this.errorResponse(c, "Missing or invalid 'text'", 400);
      }
    } catch (error) {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const model = lang === "es" ? "@cf/deepgram/aura-2-es" : "@cf/deepgram/aura-2-en";
    const inputs: Record<string, any> = {
      text: body.text,
      encoding: "mp3",
    };
    if (body.speaker) inputs.speaker = body.speaker;

    try {
      const audioBase64 = await c.env.AI.run(model, inputs);
      return c.json({ audio: audioBase64, tokenType });
    } catch (error) {
      return this.errorResponse(c, `TTS inference failed: ${String(error)}`, 500);
    }
  }
}
