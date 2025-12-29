import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilBytesFormat extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Format bytes to human readable size",
    parameters: [
      {
        name: "bytes",
        in: "query" as const,
        required: true,
        schema: { type: "integer" as const },
        description: "Number of bytes",
      },
      {
        name: "binary",
        in: "query" as const,
        required: false,
        schema: { type: "boolean" as const, default: false },
        description: "Use binary (1024) instead of decimal (1000)",
      },
      {
        name: "precision",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 2, minimum: 0, maximum: 10 },
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
        description: "Formatted size",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                bytes: { type: "integer" as const },
                formatted: { type: "string" as const },
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

    const bytesStr = c.req.query("bytes");
    const binary = c.req.query("binary") === "true";
    const precision = Math.min(10, Math.max(0, parseInt(c.req.query("precision") || "2", 10)));

    if (!bytesStr) {
      return this.errorResponse(c, "bytes parameter is required", 400);
    }

    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes) || bytes < 0) {
      return this.errorResponse(c, "bytes must be a non-negative integer", 400);
    }

    const base = binary ? 1024 : 1000;
    const units = binary
      ? ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"]
      : ["B", "KB", "MB", "GB", "TB", "PB", "EB"];

    if (bytes === 0) {
      return c.json({
        bytes,
        formatted: "0 B",
        value: 0,
        unit: "B",
        binary,
        tokenType,
      });
    }

    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
    const value = bytes / Math.pow(base, exponent);
    const formatted = `${value.toFixed(precision)} ${units[exponent]}`;

    return c.json({
      bytes,
      formatted,
      value: Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision),
      unit: units[exponent],
      binary,
      conversions: {
        bytes,
        kilobytes: Math.round((bytes / 1000) * 1000) / 1000,
        megabytes: Math.round((bytes / 1000000) * 1000) / 1000,
        gigabytes: Math.round((bytes / 1000000000) * 1000000) / 1000000,
        kibibytes: Math.round((bytes / 1024) * 1000) / 1000,
        mebibytes: Math.round((bytes / 1048576) * 1000) / 1000,
        gibibytes: Math.round((bytes / 1073741824) * 1000000) / 1000000,
      },
      tokenType,
    });
  }
}
