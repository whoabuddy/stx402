/**
 * Reusable OpenAPI schema fragments for endpoint definitions.
 * Reduces boilerplate in agent and other endpoints.
 */

// Common query parameters

export const NETWORK_PARAM = {
  name: "network",
  in: "query" as const,
  required: false,
  schema: {
    type: "string" as const,
    enum: ["mainnet", "testnet"] as const,
    default: "testnet",
  },
  description: "Stacks network to query",
};

export const TOKEN_TYPE_PARAM = {
  name: "tokenType",
  in: "query" as const,
  required: false,
  schema: {
    type: "string" as const,
    enum: ["STX", "sBTC", "USDCx"] as const,
    default: "STX",
  },
};

/** Inner schema object for TOKEN_TYPE_PARAM (used in Bazaar registry) */
export const TOKEN_TYPE_SCHEMA = TOKEN_TYPE_PARAM.schema;

export const AGENT_ID_QUERY_PARAM = {
  name: "agentId",
  in: "query" as const,
  required: true,
  schema: { type: "number" as const },
  description: "Agent ID",
};

// Common parameter arrays

export const AGENT_COMMON_PARAMS = [NETWORK_PARAM, TOKEN_TYPE_PARAM];

export const AGENT_WITH_ID_PARAMS = [
  AGENT_ID_QUERY_PARAM,
  NETWORK_PARAM,
  TOKEN_TYPE_PARAM,
];

// Common response schemas

export const COMMON_ERROR_RESPONSES = {
  "400": { description: "Invalid input" },
  "402": { description: "Payment required" },
  "501": { description: "Network not supported (mainnet not yet deployed)" },
};

export const AGENT_ERROR_RESPONSES = {
  ...COMMON_ERROR_RESPONSES,
  "404": { description: "Agent not found" },
};

// Request body schemas

export const AGENT_ID_BODY_SCHEMA = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object" as const,
        required: ["agentId"],
        properties: {
          agentId: {
            type: "number" as const,
            description: "Agent ID (sequential, starting from 0)",
          },
        },
      },
    },
  },
};

// Schema type helpers for concise definitions

export const str = { type: "string" as const };
export const num = { type: "number" as const };
export const bool = { type: "boolean" as const };
export const int = { type: "integer" as const };

export function obj(
  properties: Record<string, unknown>,
  required?: string[]
): { type: "object"; properties: Record<string, unknown>; required?: string[] } {
  const schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  } = {
    type: "object" as const,
    properties,
  };
  if (required?.length) {
    schema.required = required;
  }
  return schema;
}

export function arr(
  items: unknown
): { type: "array"; items: unknown } {
  return { type: "array" as const, items };
}

// JSON response wrapper helper

export function jsonResponse(
  description: string,
  schema: unknown
) {
  return {
    description,
    content: {
      "application/json": { schema },
    },
  };
}
