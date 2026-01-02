import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

interface PasteMetadata {
  createdAt: string;
  createdBy: string;
  language?: string;
  bytes: number;
}

export class PasteGet extends BaseEndpoint {
  schema = {
    tags: ["Paste"],
    summary: "(paid) Retrieve a paste by short code",
    parameters: [
      {
        name: "code",
        in: "path" as const,
        required: true,
        schema: {
          type: "string" as const,
          minLength: 6,
          maxLength: 6,
        },
        description: "6-character paste code",
      },
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
        description: "Paste retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                code: { type: "string" as const },
                content: { type: "string" as const },
                language: { type: "string" as const },
                createdAt: { type: "string" as const },
                createdBy: { type: "string" as const },
                bytes: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid request",
      },
      "402": {
        description: "Payment required",
      },
      "404": {
        description: "Paste not found",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const code = c.req.param("code");

    // Validate code format
    if (!code || code.length !== 6) {
      return this.errorResponse(c, "Invalid paste code format", 400);
    }

    // Retrieve paste
    const result = await c.env.STORAGE.getWithMetadata<PasteMetadata>(`paste:${code}`);

    if (result.value === null) {
      return this.errorResponse(c, "Paste not found or expired", 404, { code });
    }

    return c.json({
      code,
      content: result.value,
      language: result.metadata?.language || null,
      createdAt: result.metadata?.createdAt,
      createdBy: result.metadata?.createdBy,
      bytes: result.metadata?.bytes,
      tokenType,
    });
  }
}
