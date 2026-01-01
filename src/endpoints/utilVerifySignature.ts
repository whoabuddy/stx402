import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { Address } from "@stacks/transactions";
import {
  verifyStructuredSignature,
  verifySimpleSignature,
  getDomain,
  createActionMessage,
  isTimestampValid,
  type SignedAction,
} from "../utils/signatures";

export class UtilVerifySignature extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Verify a SIP-018 structured data signature or simple message signature",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["signature", "address"],
            properties: {
              signature: {
                type: "string" as const,
                description: "The signature to verify (hex string)",
              },
              address: {
                type: "string" as const,
                description: "The expected signer's STX address",
              },
              mode: {
                type: "string" as const,
                enum: ["structured", "simple"],
                description: "Verification mode: 'structured' for SIP-018, 'simple' for raw message",
                default: "structured",
              },
              // For structured (SIP-018) mode
              action: {
                type: "string" as const,
                enum: ["delete-endpoint", "list-my-endpoints", "transfer-ownership", "challenge-response"],
                description: "Action type for structured message (required for mode=structured)",
              },
              timestamp: {
                type: "number" as const,
                description: "Unix timestamp (ms) used in the signed message",
              },
              nonce: {
                type: "string" as const,
                description: "Nonce for challenge-response actions",
              },
              url: {
                type: "string" as const,
                description: "URL for delete-endpoint or transfer-ownership actions",
              },
              newOwner: {
                type: "string" as const,
                description: "New owner address for transfer-ownership action",
              },
              // For simple mode
              message: {
                type: "string" as const,
                description: "The message that was signed (required for mode=simple)",
              },
              validateTimestamp: {
                type: "boolean" as const,
                description: "Whether to validate timestamp is within 5 minutes (default: true)",
                default: true,
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
        description: "Verification result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                valid: { type: "boolean" as const },
                recoveredAddress: { type: "string" as const },
                expectedAddress: { type: "string" as const },
                mode: { type: "string" as const },
                timestampValid: { type: "boolean" as const },
                error: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid request",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = c.env.X402_NETWORK as "mainnet" | "testnet";

    let body: {
      signature?: string;
      address?: string;
      mode?: "structured" | "simple";
      action?: SignedAction;
      timestamp?: number;
      nonce?: string;
      url?: string;
      newOwner?: string;
      message?: string;
      validateTimestamp?: boolean;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    if (!body.signature) {
      return this.errorResponse(c, "signature is required", 400);
    }

    if (!body.address) {
      return this.errorResponse(c, "address is required", 400);
    }

    // Validate address format
    let expectedAddress: string;
    try {
      const addressObj = Address.parse(body.address);
      expectedAddress = Address.stringify(addressObj);
    } catch {
      return this.errorResponse(c, "Invalid address format", 400);
    }

    const mode = body.mode || "structured";
    const validateTimestamp = body.validateTimestamp !== false;

    if (mode === "simple") {
      // Simple message signature verification
      if (!body.message) {
        return this.errorResponse(c, "message is required for mode=simple", 400);
      }

      const result = verifySimpleSignature(
        body.message,
        body.signature,
        expectedAddress,
        network
      );

      return c.json({
        valid: result.valid,
        recoveredAddress: result.recoveredAddress,
        expectedAddress,
        mode: "simple",
        error: result.error,
        tokenType,
      });
    }

    // Structured (SIP-018) signature verification
    if (!body.action) {
      return this.errorResponse(c, "action is required for mode=structured", 400);
    }

    if (!body.timestamp) {
      return this.errorResponse(c, "timestamp is required for mode=structured", 400);
    }

    // Validate timestamp if requested
    let timestampValid = true;
    if (validateTimestamp) {
      timestampValid = isTimestampValid(body.timestamp);
    }

    // Build the structured message
    const domain = getDomain(network);
    let message;

    try {
      switch (body.action) {
        case "delete-endpoint":
          if (!body.url) {
            return this.errorResponse(c, "url is required for delete-endpoint action", 400);
          }
          message = createActionMessage("delete-endpoint", {
            url: body.url,
            owner: expectedAddress,
            timestamp: body.timestamp,
          });
          break;

        case "list-my-endpoints":
          message = createActionMessage("list-my-endpoints", {
            owner: expectedAddress,
            timestamp: body.timestamp,
          });
          break;

        case "transfer-ownership":
          if (!body.url) {
            return this.errorResponse(c, "url is required for transfer-ownership action", 400);
          }
          if (!body.newOwner) {
            return this.errorResponse(c, "newOwner is required for transfer-ownership action", 400);
          }
          message = createActionMessage("transfer-ownership", {
            url: body.url,
            owner: expectedAddress,
            newOwner: body.newOwner,
            timestamp: body.timestamp,
          });
          break;

        case "challenge-response":
          if (!body.nonce) {
            return this.errorResponse(c, "nonce is required for challenge-response action", 400);
          }
          message = createActionMessage("challenge-response", {
            owner: expectedAddress,
            nonce: body.nonce,
            timestamp: body.timestamp,
          });
          break;

        default:
          return this.errorResponse(c, `Unknown action: ${body.action}`, 400);
      }
    } catch (error) {
      return this.errorResponse(c, `Failed to create message: ${String(error)}`, 400);
    }

    const result = verifyStructuredSignature(
      message,
      domain,
      body.signature,
      expectedAddress,
      network
    );

    return c.json({
      valid: result.valid && (validateTimestamp ? timestampValid : true),
      recoveredAddress: result.recoveredAddress,
      expectedAddress,
      mode: "structured",
      action: body.action,
      timestampValid: validateTimestamp ? timestampValid : undefined,
      timestampWarning: validateTimestamp && !timestampValid
        ? "Timestamp is expired or outside valid range"
        : undefined,
      error: result.error,
      tokenType,
    });
  }
}
