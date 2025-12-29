import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilIpInfo extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) IP geolocation info",
    parameters: [
      {
        name: "ip",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const },
        description: "IP address to lookup (defaults to requester's IP)",
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
        description: "IP geolocation info",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                ip: { type: "string" as const },
                country: { type: "string" as const },
                countryCode: { type: "string" as const },
                region: { type: "string" as const },
                city: { type: "string" as const },
                postalCode: { type: "string" as const },
                latitude: { type: "string" as const },
                longitude: { type: "string" as const },
                timezone: { type: "string" as const },
                asn: { type: "integer" as const },
                asOrganization: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid IP address",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const requestedIp = c.req.query("ip");

    // Get CF properties from request
    const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;

    // If specific IP requested, we can only provide limited info
    // For requester's own IP, we have full Cloudflare geo data
    if (requestedIp) {
      // Validate IP format
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

      if (!ipv4Regex.test(requestedIp) && !ipv6Regex.test(requestedIp)) {
        return this.errorResponse(c, "Invalid IP address format", 400);
      }

      // For external IPs, use ipinfo.io or similar (limited free tier)
      // For now, return what we can from Cloudflare
      return c.json({
        ip: requestedIp,
        note: "For detailed geolocation of arbitrary IPs, use requester's IP (omit ip param)",
        tokenType,
      });
    }

    // Use Cloudflare's built-in geo data for requester's IP
    const clientIp = c.req.header("cf-connecting-ip") ||
                     c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
                     "unknown";

    return c.json({
      ip: clientIp,
      country: cf?.country || null,
      countryCode: cf?.country || null,
      region: cf?.region || null,
      regionCode: cf?.regionCode || null,
      city: cf?.city || null,
      postalCode: cf?.postalCode || null,
      latitude: cf?.latitude || null,
      longitude: cf?.longitude || null,
      timezone: cf?.timezone || null,
      continent: cf?.continent || null,
      asn: cf?.asn || null,
      asOrganization: cf?.asOrganization || null,
      colo: cf?.colo || null,
      metroCode: cf?.metroCode || null,
      tokenType,
    });
  }
}
