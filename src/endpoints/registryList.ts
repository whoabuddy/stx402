import type { AppContext } from "../types";
import { listAllEntries, type RegistryStatus } from "../utils/registry";
import { BaseEndpoint } from "./BaseEndpoint";

export class RegistryList extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(free) List all registered x402 endpoints",
    parameters: [
      {
        name: "category",
        in: "query" as const,
        required: false,
        schema: { type: "string" },
        description: "Filter by category",
      },
      {
        name: "status",
        in: "query" as const,
        required: false,
        schema: {
          type: "string",
          enum: ["unverified", "verified", "rejected"] as const,
        },
        description: "Filter by status (default: show all except rejected)",
      },
      {
        name: "limit",
        in: "query" as const,
        required: false,
        schema: { type: "number", default: 50 },
        description: "Maximum number of results (max 100)",
      },
      {
        name: "offset",
        in: "query" as const,
        required: false,
        schema: { type: "number", default: 0 },
        description: "Offset for pagination",
      },
    ],
    responses: {
      "200": {
        description: "List of registered endpoints",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                entries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      url: { type: "string" },
                      name: { type: "string" },
                      category: { type: "string" },
                      status: { type: "string" },
                      owner: { type: "string" },
                    },
                  },
                },
                total: { type: "number" },
                limit: { type: "number" },
                offset: { type: "number" },
              },
            },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    // Check if METRICS (KV) is configured
    if (!c.env.METRICS) {
      return c.json({
        entries: [],
        total: 0,
        limit: 50,
        offset: 0,
        warning: "Registry storage not configured",
      });
    }

    const category = c.req.query("category");
    const statusParam = c.req.query("status") as RegistryStatus | undefined;
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    let limit = parseInt(limitParam || "50");
    let offset = parseInt(offsetParam || "0");

    // Clamp limit to max 100
    limit = Math.min(Math.max(1, limit), 100);
    offset = Math.max(0, offset);

    const result = await listAllEntries(c.env.METRICS, {
      category: category || undefined,
      status: statusParam,
      limit,
      offset,
    });

    // Filter out rejected entries by default (unless explicitly requested)
    let filteredEntries = result.entries;
    if (!statusParam) {
      filteredEntries = result.entries.filter((e) => e.status !== "rejected");
    }

    return c.json({
      entries: filteredEntries,
      total: result.total,
      limit,
      offset,
    });
  }
}
