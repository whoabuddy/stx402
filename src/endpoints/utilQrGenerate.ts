import QRCode from "qrcode";
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilQrGenerate extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Generate QR code as PNG or SVG",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["data"],
            properties: {
              data: {
                type: "string" as const,
                description: "Data to encode in QR code (URL, text, etc.)",
                maxLength: 2048,
              },
              format: {
                type: "string" as const,
                enum: ["png", "svg", "base64"] as const,
                default: "png",
                description: "Output format",
              },
              size: {
                type: "integer" as const,
                default: 200,
                minimum: 50,
                maximum: 1000,
                description: "Size in pixels (for PNG)",
              },
              margin: {
                type: "integer" as const,
                default: 2,
                minimum: 0,
                maximum: 10,
                description: "Quiet zone margin",
              },
              dark: {
                type: "string" as const,
                default: "#000000",
                description: "Dark module color (hex)",
              },
              light: {
                type: "string" as const,
                default: "#ffffff",
                description: "Light module color (hex)",
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
        description: "QR code image",
        content: {
          "image/png": {
            schema: { type: "string" as const, format: "binary" as const },
          },
          "image/svg+xml": {
            schema: { type: "string" as const },
          },
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                base64: { type: "string" as const },
                mimeType: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: {
      data?: string;
      format?: string;
      size?: number;
      margin?: number;
      dark?: string;
      light?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const {
      data,
      format = "png",
      size = 200,
      margin = 2,
      dark = "#000000",
      light = "#ffffff",
    } = body;

    if (!data || typeof data !== "string") {
      return this.errorResponse(c, "data field is required and must be a string", 400);
    }

    if (data.length > 2048) {
      return this.errorResponse(c, "data exceeds maximum length of 2048 characters", 400);
    }

    const validFormats = ["png", "svg", "base64"];
    if (!validFormats.includes(format)) {
      return this.errorResponse(c, `Invalid format. Valid: ${validFormats.join(", ")}`, 400);
    }

    // Validate hex colors
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(dark) || !hexRegex.test(light)) {
      return this.errorResponse(c, "Colors must be hex format (#RRGGBB)", 400);
    }

    const clampedSize = Math.max(50, Math.min(1000, size));
    const clampedMargin = Math.max(0, Math.min(10, margin));

    try {
      const options = {
        width: clampedSize,
        margin: clampedMargin,
        color: {
          dark,
          light,
        },
      };

      if (format === "svg") {
        const svg = await QRCode.toString(data, { ...options, type: "svg" });
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml",
            "X-Token-Type": tokenType,
          },
        });
      }

      if (format === "base64") {
        const dataUrl = await QRCode.toDataURL(data, options);
        return c.json({
          base64: dataUrl,
          mimeType: "image/png",
          size: clampedSize,
          tokenType,
        });
      }

      // PNG format - return as buffer
      const buffer = await QRCode.toBuffer(data, options);
      return new Response(buffer, {
        headers: {
          "Content-Type": "image/png",
          "X-Token-Type": tokenType,
        },
      });
    } catch (error) {
      return this.errorResponse(c, `QR generation failed: ${String(error)}`, 500);
    }
  }
}
