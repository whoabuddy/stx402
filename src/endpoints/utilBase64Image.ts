import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilBase64Image extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Generate a simple placeholder image as base64",
    parameters: [
      {
        name: "width",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 200, minimum: 1, maximum: 1000 },
      },
      {
        name: "height",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 200, minimum: 1, maximum: 1000 },
      },
      {
        name: "color",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, default: "#cccccc" },
        description: "Background color (hex)",
      },
      {
        name: "text",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const },
        description: "Text to display (defaults to dimensions)",
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "Base64 encoded SVG image",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                base64: { type: "string" as const },
                dataUri: { type: "string" as const },
                width: { type: "integer" as const },
                height: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid parameters" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const width = Math.min(1000, Math.max(1, parseInt(c.req.query("width") || "200", 10)));
    const height = Math.min(1000, Math.max(1, parseInt(c.req.query("height") || "200", 10)));
    const color = c.req.query("color") || "#cccccc";
    const text = c.req.query("text") || `${width}×${height}`;

    // Validate color
    if (!/^#[0-9a-fA-F]{3,6}$/.test(color)) {
      return this.errorResponse(c, "Invalid color format. Use hex (e.g., #cccccc)", 400);
    }

    // Calculate text color based on background
    const bgLuminance = this.getLuminance(color);
    const textColor = bgLuminance > 0.5 ? "#333333" : "#ffffff";

    // Calculate font size based on dimensions
    const fontSize = Math.min(width / (text.length * 0.6), height / 3, 48);

    // Generate SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${color}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="${textColor}">${this.escapeXml(text)}</text>
</svg>`;

    const base64 = btoa(svg);
    const dataUri = `data:image/svg+xml;base64,${base64}`;

    return c.json({
      base64,
      dataUri,
      width,
      height,
      color,
      text,
      format: "svg",
      tokenType,
    });
  }

  private getLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
