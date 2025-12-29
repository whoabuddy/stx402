import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilUrlBuild extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Build URL from components",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["hostname"],
            properties: {
              protocol: { type: "string" as const, default: "https", description: "Protocol (http, https)" },
              hostname: { type: "string" as const, description: "Hostname" },
              port: { type: "integer" as const, description: "Port number" },
              pathname: { type: "string" as const, default: "/", description: "Path" },
              query: { type: "object" as const, description: "Query parameters object" },
              hash: { type: "string" as const, description: "Fragment identifier" },
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
        description: "Built URL",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                url: { type: "string" as const },
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

    let body: {
      protocol?: string;
      hostname?: string;
      port?: number;
      pathname?: string;
      query?: Record<string, string | number | boolean | string[]>;
      hash?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { protocol = "https", hostname, port, pathname = "/", query, hash } = body;

    if (!hostname || typeof hostname !== "string") {
      return this.errorResponse(c, "hostname is required", 400);
    }

    // Build URL
    let url = `${protocol}://${hostname}`;

    if (port) {
      url += `:${port}`;
    }

    // Ensure pathname starts with /
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    url += normalizedPath;

    // Build query string
    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            params.append(key, String(v));
          }
        } else {
          params.append(key, String(value));
        }
      }
      url += `?${params.toString()}`;
    }

    // Add hash
    if (hash) {
      const normalizedHash = hash.startsWith("#") ? hash : `#${hash}`;
      url += normalizedHash;
    }

    // Validate the built URL
    try {
      new URL(url);
    } catch {
      return this.errorResponse(c, "Invalid URL components", 400);
    }

    return c.json({
      url,
      components: {
        protocol,
        hostname,
        port: port || null,
        pathname: normalizedPath,
        query: query || null,
        hash: hash || null,
      },
      tokenType,
    });
  }
}
