import {
  deserializeTransaction,
  PayloadType,
  AuthType,
  AddressHashMode,
  cvToJSON,
} from "@stacks/transactions";
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

const PAYLOAD_TYPE_NAMES: Record<number, string> = {
  [PayloadType.TokenTransfer]: "token_transfer",
  [PayloadType.SmartContract]: "smart_contract",
  [PayloadType.VersionedSmartContract]: "versioned_smart_contract",
  [PayloadType.ContractCall]: "contract_call",
  [PayloadType.Coinbase]: "coinbase",
  [PayloadType.CoinbaseToAltRecipient]: "coinbase_to_alt_recipient",
  [PayloadType.NakamotoCoinbase]: "nakamoto_coinbase",
  [PayloadType.PoisonMicroblock]: "poison_microblock",
  [PayloadType.TenureChange]: "tenure_change",
};

const AUTH_TYPE_NAMES: Record<number, string> = {
  [AuthType.Standard]: "standard",
  [AuthType.Sponsored]: "sponsored",
};

const HASH_MODE_NAMES: Record<number, string> = {
  [AddressHashMode.SerializeP2PKH]: "p2pkh",
  [AddressHashMode.SerializeP2SH]: "p2sh",
  [AddressHashMode.SerializeP2WPKH]: "p2wpkh",
  [AddressHashMode.SerializeP2WSH]: "p2wsh",
};

export class StacksDecodeTx extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Decode raw Stacks transaction hex",
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
                description: "Raw transaction hex (with or without 0x prefix)",
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
        description: "Decoded transaction",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                version: { type: "integer" as const },
                chainId: { type: "integer" as const },
                authType: { type: "string" as const },
                payloadType: { type: "string" as const },
                payload: { type: "object" as const },
                fee: { type: "string" as const },
                nonce: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid transaction hex",
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

    const { hex } = body;

    if (!hex || typeof hex !== "string") {
      return this.errorResponse(c, "hex field is required and must be a string", 400);
    }

    try {
      // Remove 0x prefix if present - deserializeTransaction accepts hex strings directly
      const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

      const tx = deserializeTransaction(cleanHex);

      // Build payload info based on type
      let payloadInfo: Record<string, unknown> = {};
      const payload = tx.payload;

      switch (payload.payloadType) {
        case PayloadType.TokenTransfer:
          payloadInfo = {
            recipient: payload.recipient,
            amount: payload.amount.toString(),
            memo: payload.memo ? new TextDecoder().decode(payload.memo.content).replace(/\0/g, "") : "",
          };
          break;

        case PayloadType.ContractCall:
          payloadInfo = {
            contractAddress: payload.contractAddress,
            contractName: payload.contractName.content,
            functionName: payload.functionName.content,
            functionArgs: payload.functionArgs.map((arg) => cvToJSON(arg)),
          };
          break;

        case PayloadType.SmartContract:
        case PayloadType.VersionedSmartContract:
          payloadInfo = {
            contractName: payload.contractName.content,
            codeBody: payload.codeBody.content.substring(0, 500) + (payload.codeBody.content.length > 500 ? "..." : ""),
            codeLength: payload.codeBody.content.length,
          };
          break;

        case PayloadType.Coinbase:
        case PayloadType.CoinbaseToAltRecipient:
        case PayloadType.NakamotoCoinbase:
          payloadInfo = { type: "coinbase" };
          break;

        default:
          payloadInfo = { raw: "unsupported_payload_type" };
      }

      // Extract auth info
      const auth = tx.auth;
      const spendingCondition = auth.spendingCondition;

      return c.json({
        version: tx.version,
        chainId: tx.chainId,
        authType: AUTH_TYPE_NAMES[auth.authType] || `unknown_${auth.authType}`,
        payloadType: PAYLOAD_TYPE_NAMES[payload.payloadType] || `unknown_${payload.payloadType}`,
        payload: payloadInfo,
        sender: {
          hashMode: HASH_MODE_NAMES[spendingCondition.hashMode] || `unknown_${spendingCondition.hashMode}`,
          nonce: spendingCondition.nonce.toString(),
          fee: spendingCondition.fee.toString(),
        },
        postConditionMode: tx.postConditionMode,
        postConditionsCount: tx.postConditions.length,
        anchorMode: tx.anchorMode,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to decode transaction: ${String(error)}`, 400);
    }
  }
}
