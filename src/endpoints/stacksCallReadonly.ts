import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  ClarityValue,
  parseToCV,
} from "@stacks/transactions";
import { getFetchOptions, setFetchOptions } from "@stacks/common";
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { getNetworkFromPrincipal } from "../utils/network";

// Fix stacks.js fetch for Workers
type StacksRequestInit = RequestInit & { referrerPolicy?: string };
const fetchOptions: StacksRequestInit = getFetchOptions();
delete fetchOptions.referrerPolicy;
setFetchOptions(fetchOptions);

export class StacksCallReadonly extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Call a read-only Clarity function",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["contractAddress", "contractName", "functionName"],
            properties: {
              contractAddress: {
                type: "string" as const,
                description: "Contract deployer address",
              },
              contractName: {
                type: "string" as const,
                description: "Contract name",
              },
              functionName: {
                type: "string" as const,
                description: "Read-only function name",
              },
              functionArgs: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Function arguments as Clarity value strings (e.g., 'u100', '\"hello\"', 'SP123...')",
                default: [],
              },
              senderAddress: {
                type: "string" as const,
                description: "Sender address for the call (defaults to contract address)",
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
        description: "Function call result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                result: { type: "object" as const },
                okay: { type: "boolean" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input or function call failed",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: {
      contractAddress?: string;
      contractName?: string;
      functionName?: string;
      functionArgs?: string[];
      senderAddress?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const {
      contractAddress,
      contractName,
      functionName,
      functionArgs = [],
      senderAddress,
    } = body;

    if (!contractAddress || !contractName || !functionName) {
      return this.errorResponse(
        c,
        "contractAddress, contractName, and functionName are required",
        400
      );
    }

    let network: string;
    try {
      network = getNetworkFromPrincipal(contractAddress);
    } catch {
      return this.errorResponse(c, "Invalid contract address", 400);
    }

    // Parse function arguments
    let parsedArgs: ClarityValue[];
    try {
      parsedArgs = functionArgs.map((arg) => parseToCV(arg));
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to parse function arguments: ${String(error)}`,
        400
      );
    }

    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName,
        functionArgs: parsedArgs,
        senderAddress: senderAddress || contractAddress,
        network,
      });

      return c.json({
        result: cvToJSON(result),
        okay: true,
        contractId: `${contractAddress}.${contractName}`,
        functionName,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Read-only call failed: ${String(error)}`,
        400
      );
    }
  }
}
