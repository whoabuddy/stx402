import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

type RecordType = "A" | "AAAA" | "MX" | "TXT" | "CNAME" | "NS";

export class UtilDnsLookup extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) DNS lookup - resolve domain to records",
    parameters: [
      {
        name: "domain",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Domain to lookup (e.g., example.com)",
      },
      {
        name: "type",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["A", "AAAA", "MX", "TXT", "CNAME", "NS"] as const,
          default: "A",
        },
        description: "DNS record type",
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
        description: "DNS lookup results",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                domain: { type: "string" as const },
                type: { type: "string" as const },
                records: { type: "array" as const, items: { type: "object" as const } },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid domain or record type",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const domain = c.req.query("domain");
    const recordType = (c.req.query("type") || "A").toUpperCase() as RecordType;

    if (!domain) {
      return this.errorResponse(c, "domain parameter is required", 400);
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) {
      return this.errorResponse(c, "Invalid domain format", 400);
    }

    const validTypes: RecordType[] = ["A", "AAAA", "MX", "TXT", "CNAME", "NS"];
    if (!validTypes.includes(recordType)) {
      return this.errorResponse(c, `Invalid record type. Valid: ${validTypes.join(", ")}`, 400);
    }

    try {
      // Use Cloudflare's DNS over HTTPS
      const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${recordType}`;

      const response = await fetch(dohUrl, {
        headers: {
          Accept: "application/dns-json",
        },
      });

      if (!response.ok) {
        return this.errorResponse(c, `DNS lookup failed: ${response.status}`, 500);
      }

      const data = await response.json() as {
        Status: number;
        Answer?: Array<{
          name: string;
          type: number;
          TTL: number;
          data: string;
        }>;
      };

      // Parse records based on type
      const records = (data.Answer || []).map((answer) => {
        const base = {
          name: answer.name,
          ttl: answer.TTL,
          data: answer.data,
        };

        // Add parsed fields for specific types
        if (recordType === "MX") {
          const parts = answer.data.split(" ");
          return {
            ...base,
            priority: parseInt(parts[0], 10),
            exchange: parts[1],
          };
        }

        return base;
      });

      return c.json({
        domain,
        type: recordType,
        records,
        status: data.Status === 0 ? "success" : "no_records",
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `DNS lookup failed: ${String(error)}`, 500);
    }
  }
}
