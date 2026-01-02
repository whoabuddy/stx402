import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

interface PasteMetadata {
  createdAt: string;
  createdBy: string;
  language?: string;
  bytes: number;
}

export class PasteDelete extends BaseEndpoint {
  schema = {
    tags: ["Paste"],
    summary: "(paid) Delete a paste by short code (owner only)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["code"],
            properties: {
              code: {
                type: "string" as const,
                description: "6-character paste code",
                minLength: 6,
                maxLength: 6,
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
        description: "Paste deleted successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                deleted: { type: "string" as const },
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
      "403": {
        description: "Not authorized to delete this paste",
      },
      "404": {
        description: "Paste not found",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: { code: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { code } = body;

    // Validate code format
    if (!code || code.length !== 6) {
      return this.errorResponse(c, "Invalid paste code format", 400);
    }

    // Get paste metadata to verify ownership
    const result = await c.env.STORAGE.getWithMetadata<PasteMetadata>(`paste:${code}`);

    if (result.value === null) {
      return this.errorResponse(c, "Paste not found or expired", 404, { code });
    }

    // Verify ownership
    if (result.metadata?.createdBy !== payerAddress) {
      return this.errorResponse(c, "Not authorized to delete this paste", 403, { code });
    }

    // Delete paste
    await c.env.STORAGE.delete(`paste:${code}`);

    return c.json({
      success: true,
      deleted: code,
      tokenType,
    });
  }
}
