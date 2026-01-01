import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class NetAsnLookup extends BaseEndpoint {
  schema = {
    tags: ["Network"],
    summary: "(paid) ASN/ISP info for requester's IP using Cloudflare edge data",
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
        description: "ASN and ISP information for requester's IP",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                ip: { type: "string" as const, description: "Client IP address" },
                asn: { type: "integer" as const, description: "Autonomous System Number" },
                asOrganization: { type: "string" as const, description: "Organization that owns the ASN" },
                isBot: { type: "string" as const, description: "Bot detection score (if available)" },
                httpProtocol: { type: "string" as const, description: "HTTP protocol version used" },
                tlsVersion: { type: "string" as const, description: "TLS version used" },
                tlsCipher: { type: "string" as const, description: "TLS cipher suite" },
                clientTrustScore: { type: "integer" as const, description: "Cloudflare client trust score (if available)" },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    // Get CF properties from request
    const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;

    // Get client IP from Cloudflare headers
    const ip =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    return c.json({
      ip,
      asn: cf?.asn || null,
      asOrganization: cf?.asOrganization || null,
      isBot: cf?.isEUCountry !== undefined ? (cf as any).botManagement?.score : null,
      httpProtocol: cf?.httpProtocol || null,
      tlsVersion: cf?.tlsVersion || null,
      tlsCipher: cf?.tlsCipher || null,
      clientTrustScore: (cf as any)?.clientTrustScore || null,
      tokenType,
    });
  }
}
