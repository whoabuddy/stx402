import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";

interface TxResponse {
  tx_id: string;
  tx_status: string;
  tx_type: string;
  fee_rate: string;
  sender_address: string;
  block_height?: number;
  block_hash?: string;
  burn_block_time?: number;
  canonical: boolean;
  tx_result?: { hex: string; repr: string };
}

export class StacksTxStatus extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get transaction status by txid",
    parameters: [
      {
        name: "txid",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Transaction ID (with or without 0x prefix)",
      },
      {
        name: "network",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["mainnet", "testnet"] as const,
          default: "mainnet",
        },
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
        description: "Transaction status",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                txid: { type: "string" as const },
                status: { type: "string" as const },
                type: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid txid" },
      "402": { description: "Payment required" },
      "404": { description: "Transaction not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const txid = c.req.param("txid");
    const network = c.req.query("network") || "mainnet";

    if (!txid) {
      return this.errorResponse(c, "txid parameter is required", 400);
    }

    // Normalize txid (ensure 0x prefix)
    const normalizedTxid = txid.startsWith("0x") ? txid : `0x${txid}`;

    // Validate txid format (should be 66 chars with 0x prefix)
    if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedTxid)) {
      return this.errorResponse(c, "Invalid txid format", 400);
    }

    if (network !== "mainnet" && network !== "testnet") {
      return this.errorResponse(c, "Invalid network", 400);
    }

    const apiUrl = getHiroApiUrl(network);

    try {
      const response = await hiroFetch(`${apiUrl}/extended/v1/tx/${normalizedTxid}`, {
        headers: { Accept: "application/json" },
      });

      if (response.status === 404) {
        return this.errorResponse(c, "Transaction not found", 404);
      }

      if (!response.ok) {
        return this.errorResponse(c, `API error: ${response.status}`, 500);
      }

      const data = await response.json() as TxResponse;

      return c.json({
        txid: data.tx_id,
        status: data.tx_status,
        type: data.tx_type,
        sender: data.sender_address,
        fee: data.fee_rate,
        blockHeight: data.block_height || null,
        blockHash: data.block_hash || null,
        burnBlockTime: data.burn_block_time || null,
        canonical: data.canonical,
        result: data.tx_result?.repr || null,
        network,
        tokenType,
      });
    } catch (error) {
      if (isHiroRateLimitError(error)) {
        c.header("Retry-After", String(error.rateLimitError.retryAfter));
        return c.json({
          error: error.rateLimitError.error,
          code: error.rateLimitError.code,
          retryAfter: error.rateLimitError.retryAfter,
          tokenType,
        }, 503);
      }
      return this.errorResponse(c, `Failed to fetch tx: ${String(error)}`, 500);
    }
  }
}
