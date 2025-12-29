import {
  serializeCV,
  intCV,
  uintCV,
  bufferCV,
  stringAsciiCV,
  stringUtf8CV,
  trueCV,
  falseCV,
  noneCV,
  someCV,
  listCV,
  tupleCV,
  standardPrincipalCV,
  contractPrincipalCV,
  responseOkCV,
  responseErrorCV,
  ClarityValue,
} from "@stacks/transactions";
import { bytesToHex } from "@noble/hashes/utils";
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

type ClarityInput =
  | { type: "int"; value: string | number }
  | { type: "uint"; value: string | number }
  | { type: "buff"; value: string }
  | { type: "string-ascii"; value: string }
  | { type: "string-utf8"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "none" }
  | { type: "some"; value: ClarityInput }
  | { type: "list"; value: ClarityInput[] }
  | { type: "tuple"; value: Record<string, ClarityInput> }
  | { type: "principal"; value: string }
  | { type: "ok"; value: ClarityInput }
  | { type: "err"; value: ClarityInput };

function buildClarityValue(input: ClarityInput): ClarityValue {
  switch (input.type) {
    case "int":
      return intCV(BigInt(input.value));
    case "uint":
      return uintCV(BigInt(input.value));
    case "buff": {
      // Accept hex string (with or without 0x prefix)
      const hex = input.value.startsWith("0x") ? input.value.slice(2) : input.value;
      const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []);
      return bufferCV(bytes);
    }
    case "string-ascii":
      return stringAsciiCV(input.value);
    case "string-utf8":
      return stringUtf8CV(input.value);
    case "bool":
      return input.value ? trueCV() : falseCV();
    case "none":
      return noneCV();
    case "some":
      return someCV(buildClarityValue(input.value));
    case "list":
      return listCV(input.value.map(buildClarityValue));
    case "tuple": {
      const entries: Record<string, ClarityValue> = {};
      for (const [key, val] of Object.entries(input.value)) {
        entries[key] = buildClarityValue(val);
      }
      return tupleCV(entries);
    }
    case "principal": {
      const parts = input.value.split(".");
      if (parts.length === 2) {
        return contractPrincipalCV(parts[0], parts[1]);
      }
      return standardPrincipalCV(input.value);
    }
    case "ok":
      return responseOkCV(buildClarityValue(input.value));
    case "err":
      return responseErrorCV(buildClarityValue(input.value));
    default:
      throw new Error(`Unknown Clarity type: ${(input as ClarityInput).type}`);
  }
}

export class StacksToConsensusBuff extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Serialize a Clarity value to consensus buffer (compatible with to-consensus-buff?)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["value"],
            properties: {
              value: {
                type: "object" as const,
                description: "Clarity value to serialize. Format: {type: 'int'|'uint'|'buff'|'string-ascii'|'string-utf8'|'bool'|'none'|'some'|'list'|'tuple'|'principal'|'ok'|'err', value: ...}",
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
        description: "Serialized buffer",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                hex: { type: "string" as const, description: "Hex-encoded consensus buffer (with 0x prefix)" },
                bytes: { type: "integer" as const, description: "Length in bytes" },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { value?: ClarityInput };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    if (!body.value || typeof body.value !== "object") {
      return this.errorResponse(c, "value field is required and must be a Clarity value object", 400);
    }

    try {
      const cv = buildClarityValue(body.value);
      const serialized = serializeCV(cv);
      const hex = "0x" + bytesToHex(serialized);

      return c.json({
        hex,
        bytes: serialized.length,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to serialize: ${String(error)}`, 400);
    }
  }
}
