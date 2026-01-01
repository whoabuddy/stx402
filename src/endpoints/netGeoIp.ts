import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class NetGeoIp extends BaseEndpoint {
  schema = {
    tags: ["Network"],
    summary: "(paid) Geo-locate requester's IP using Cloudflare edge data",
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
        description: "Geolocation data for requester's IP",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                ip: { type: "string" as const, description: "Client IP address" },
                country: { type: "string" as const, description: "Country name" },
                countryCode: { type: "string" as const, description: "ISO 3166-1 alpha-2 country code" },
                continent: { type: "string" as const, description: "Continent code (NA, EU, AS, etc.)" },
                region: { type: "string" as const, description: "Region/state name" },
                regionCode: { type: "string" as const, description: "Region code" },
                city: { type: "string" as const, description: "City name" },
                postalCode: { type: "string" as const, description: "Postal/ZIP code" },
                latitude: { type: "string" as const, description: "Latitude coordinate" },
                longitude: { type: "string" as const, description: "Longitude coordinate" },
                timezone: { type: "string" as const, description: "IANA timezone (e.g., America/New_York)" },
                colo: { type: "string" as const, description: "Cloudflare datacenter that served the request" },
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
      country: cf?.country || null,
      countryCode: cf?.country || null,
      continent: cf?.continent || null,
      region: cf?.region || null,
      regionCode: cf?.regionCode || null,
      city: cf?.city || null,
      postalCode: cf?.postalCode || null,
      latitude: cf?.latitude || null,
      longitude: cf?.longitude || null,
      timezone: cf?.timezone || null,
      colo: cf?.colo || null,
      tokenType,
    });
  }
}
