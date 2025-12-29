import {
  deserializeCV,
  cvToJSON,
  ClarityType,
  ClarityValue,
} from "@stacks/transactions";
import { hexToBytes } from "@noble/hashes/utils";
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

function clarityTypeToString(type: ClarityType): string {
  const typeMap: Record<ClarityType, string> = {
    [ClarityType.Int]: "int",
    [ClarityType.UInt]: "uint",
    [ClarityType.Buffer]: "buff",
    [ClarityType.BoolTrue]: "bool",
    [ClarityType.BoolFalse]: "bool",
    [ClarityType.PrincipalStandard]: "principal",
    [ClarityType.PrincipalContract]: "principal",
    [ClarityType.ResponseOk]: "ok",
    [ClarityType.ResponseErr]: "err",
    [ClarityType.OptionalNone]: "none",
    [ClarityType.OptionalSome]: "some",
    [ClarityType.List]: "list",
    [ClarityType.Tuple]: "tuple",
    [ClarityType.StringASCII]: "string-ascii",
    [ClarityType.StringUTF8]: "string-utf8",
  };
  return typeMap[type] || "unknown";
}

function describeCV(cv: ClarityValue): object {
  const json = cvToJSON(cv);
  return {
    type: clarityTypeToString(cv.type),
    value: json,
  };
}

export class StacksFromConsensusBuff extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Deserialize a consensus buffer to Clarity value (compatible with from-consensus-buff?)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["hex"],
            properties: {
              hex: {
                type: "string" as const,
                description: "Hex-encoded consensus buffer (with or without 0x prefix)",
              },
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
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "Deserialized Clarity value",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                type: { type: "string" as const },
                value: { type: "object" as const },
                repr: { type: "string" as const, description: "Human-readable representation" },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input or malformed buffer",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { hex?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    if (typeof body.hex !== "string") {
      return this.errorResponse(c, "hex field is required and must be a string", 400);
    }

    try {
      // Remove 0x prefix if present
      const hex = body.hex.startsWith("0x") ? body.hex.slice(2) : body.hex;
      const bytes = hexToBytes(hex);

      const cv = deserializeCV(bytes);
      const described = describeCV(cv);

      // Generate human-readable repr
      const json = cvToJSON(cv);
      let repr: string;
      try {
        repr = typeof json === "object" ? JSON.stringify(json) : String(json);
      } catch {
        repr = "[complex value]";
      }

      return c.json({
        ...described,
        repr,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to deserialize: ${String(error)}`, 400);
    }
  }
}
