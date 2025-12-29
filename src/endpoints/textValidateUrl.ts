import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextValidateUrl extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Validate URL format",
    parameters: [
      {
        name: "url",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "URL to validate",
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
        description: "Validation result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                url: { type: "string" as const },
                isValid: { type: "boolean" as const },
                protocol: { type: "string" as const },
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

    const url = c.req.query("url");

    if (!url) {
      return this.errorResponse(c, "url parameter is required", 400);
    }

    const issues: string[] = [];
    let isValid = true;
    let parsed: URL | null = null;

    try {
      parsed = new URL(url);
    } catch {
      isValid = false;
      issues.push("Invalid URL format");
    }

    if (parsed) {
      // Check for valid protocol
      const validProtocols = ["http:", "https:", "ftp:", "mailto:", "tel:"];
      if (!validProtocols.includes(parsed.protocol)) {
        issues.push(`Unusual protocol: ${parsed.protocol}`);
      }

      // Check for hostname
      if (!parsed.hostname && !["mailto:", "tel:"].includes(parsed.protocol)) {
        isValid = false;
        issues.push("Missing hostname");
      }

      // Check for valid port
      if (parsed.port) {
        const port = parseInt(parsed.port, 10);
        if (port < 1 || port > 65535) {
          isValid = false;
          issues.push("Invalid port number");
        }
      }
    }

    return c.json({
      url,
      isValid,
      issues: issues.length > 0 ? issues : null,
      ...(parsed && {
        parsed: {
          protocol: parsed.protocol.replace(":", ""),
          hostname: parsed.hostname,
          port: parsed.port || null,
          pathname: parsed.pathname,
          search: parsed.search || null,
          hash: parsed.hash || null,
        },
        isSecure: parsed.protocol === "https:",
        hasQuery: parsed.search.length > 1,
        hasFragment: parsed.hash.length > 1,
      }),
      tokenType,
    });
  }
}
