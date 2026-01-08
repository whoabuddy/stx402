import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { OpenAPIRouteSchema } from "chanfana";
import {
  makeContractCall,
  PostConditionMode,
  uintCV,
  principalCV,
  bufferCV,
  serializeCV,
  createSTXPostCondition,
  createFungiblePostCondition,
  FungibleConditionCode,
  AnchorMode,
} from "@stacks/transactions";
import { bytesToHex } from "@noble/hashes/utils";

// Contract addresses
const SBTC_TOKEN = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const SBTC_DECIMALS = 8;

// Protocol contracts
const PROTOCOLS = {
  alex_pool: {
    address: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9",
    name: "amm-pool-v2-01",
    actions: {
      "add-liquidity": "add-to-position",
      "remove-liquidity": "reduce-position",
      swap: "swap-helper",
    },
  },
  alex_vault: {
    address: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9",
    name: "auto-alex-v3",
    actions: {
      deposit: "add-to-position",
      withdraw: "reduce-position",
    },
  },
  stackingdao: {
    address: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
    name: "stacking-dao-core-v1",
    actions: {
      deposit: "deposit",
      withdraw: "withdraw",
    },
  },
  arkadiko: {
    address: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
    name: "arkadiko-vaults-v1",
    actions: {
      deposit: "deposit-collateral",
      withdraw: "withdraw-collateral",
    },
  },
};

type ActionType = "transfer" | "deposit" | "withdraw" | "swap" | "add-liquidity" | "remove-liquidity";
type ProtocolName = "alex_pool" | "alex_vault" | "stackingdao" | "arkadiko";

interface ActionParams {
  action: ActionType;
  amount: number;
  recipient?: string;
  protocol?: ProtocolName;
  slippage?: number;
}

function sbtcToSats(amount: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, SBTC_DECIMALS)));
}

function buildTransferPayload(
  sender: string,
  recipient: string,
  amount: number
): {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: string[];
  postConditions: string;
  estimatedFee: number;
} {
  const [contractAddress, contractName] = SBTC_TOKEN.split(".");
  const amountSats = sbtcToSats(amount);

  return {
    contractAddress,
    contractName,
    functionName: "transfer",
    functionArgs: [
      bytesToHex(serializeCV(uintCV(amountSats))),
      bytesToHex(serializeCV(principalCV(sender))),
      bytesToHex(serializeCV(principalCV(recipient))),
      bytesToHex(serializeCV(bufferCV(new Uint8Array()))), // memo
    ],
    postConditions: `sender sends exactly ${amount} sBTC`,
    estimatedFee: 2500, // microSTX
  };
}

function buildDepositPayload(
  protocol: ProtocolName,
  amount: number
): {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: string[];
  postConditions: string;
  estimatedFee: number;
  notes: string;
} {
  const proto = PROTOCOLS[protocol];
  const amountSats = sbtcToSats(amount);

  return {
    contractAddress: proto.address,
    contractName: proto.name,
    functionName: proto.actions.deposit || "deposit",
    functionArgs: [
      bytesToHex(serializeCV(uintCV(amountSats))),
    ],
    postConditions: `sender sends up to ${amount} sBTC to ${protocol}`,
    estimatedFee: 5000,
    notes: `Deposit ${amount} sBTC into ${protocol}. You will receive LP tokens or staked position.`,
  };
}

function buildWithdrawPayload(
  protocol: ProtocolName,
  amount: number
): {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: string[];
  postConditions: string;
  estimatedFee: number;
  notes: string;
} {
  const proto = PROTOCOLS[protocol];
  const amountSats = sbtcToSats(amount);

  return {
    contractAddress: proto.address,
    contractName: proto.name,
    functionName: proto.actions.withdraw || "withdraw",
    functionArgs: [
      bytesToHex(serializeCV(uintCV(amountSats))),
    ],
    postConditions: `${protocol} sends up to ${amount} sBTC to sender`,
    estimatedFee: 5000,
    notes: `Withdraw ${amount} sBTC from ${protocol}. Ensure you have sufficient position to withdraw.`,
  };
}

function buildSwapPayload(
  amount: number,
  fromAsset: string,
  toAsset: string,
  slippage: number
): {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: string[];
  postConditions: string;
  estimatedFee: number;
  notes: string;
  minReceived: number;
} {
  const proto = PROTOCOLS.alex_pool;
  const amountSats = sbtcToSats(amount);
  const minReceived = amount * (1 - slippage / 100);

  return {
    contractAddress: proto.address,
    contractName: proto.name,
    functionName: "swap-helper",
    functionArgs: [
      bytesToHex(serializeCV(uintCV(amountSats))),
      bytesToHex(serializeCV(uintCV(sbtcToSats(minReceived)))), // min-out
    ],
    postConditions: `sender sends ${amount} ${fromAsset}, receives at least ${minReceived.toFixed(6)} ${toAsset}`,
    estimatedFee: 8000,
    notes: `Swap ${amount} ${fromAsset} for ${toAsset} via ALEX. Slippage tolerance: ${slippage}%`,
    minReceived,
  };
}

export class SbtcActions extends BaseEndpoint {
  schema: OpenAPIRouteSchema = {
    tags: ["sBTC"],
    summary: "(paid) Generate sBTC transaction payloads",
    description: "Build transaction payloads for sBTC operations - transfer, deposit, withdraw, swap. Returns unsigned transaction data for agent signing.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["action", "amount", "sender"],
            properties: {
              action: {
                type: "string",
                enum: ["transfer", "deposit", "withdraw", "swap"],
                description: "Action to perform",
              },
              amount: {
                type: "number",
                description: "Amount of sBTC",
              },
              sender: {
                type: "string",
                description: "Sender address (for post-conditions)",
              },
              recipient: {
                type: "string",
                description: "Recipient address (for transfer)",
              },
              protocol: {
                type: "string",
                enum: ["alex_pool", "alex_vault", "stackingdao", "arkadiko"],
                description: "Protocol for deposit/withdraw",
              },
              slippage: {
                type: "number",
                default: 1,
                description: "Slippage tolerance % for swaps",
              },
              toAsset: {
                type: "string",
                default: "STX",
                description: "Target asset for swaps",
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Transaction payload",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                action: { type: "string" },
                payload: { type: "object" },
                simulation: { type: "object" },
              },
            },
          },
        },
      },
      "400": { description: "Invalid parameters" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: {
      action?: ActionType;
      amount?: number;
      sender?: string;
      recipient?: string;
      protocol?: ProtocolName;
      slippage?: number;
      toAsset?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { action, amount, sender, recipient, protocol, slippage = 1, toAsset = "STX" } = body;

    if (!action || !amount || !sender) {
      return this.errorResponse(c, "action, amount, and sender are required", 400);
    }

    if (amount <= 0) {
      return this.errorResponse(c, "amount must be positive", 400);
    }

    if (!sender.startsWith("SP") && !sender.startsWith("SM")) {
      return this.errorResponse(c, "Invalid sender address", 400);
    }

    let payload: any;
    let simulation: any;

    switch (action) {
      case "transfer":
        if (!recipient) {
          return this.errorResponse(c, "recipient required for transfer", 400);
        }
        if (!recipient.startsWith("SP") && !recipient.startsWith("SM")) {
          return this.errorResponse(c, "Invalid recipient address", 400);
        }
        payload = buildTransferPayload(sender, recipient, amount);
        simulation = {
          from: sender,
          to: recipient,
          amount: `${amount} sBTC`,
          amountSats: sbtcToSats(amount).toString(),
          type: "SIP-010 token transfer",
        };
        break;

      case "deposit":
        if (!protocol) {
          return this.errorResponse(c, "protocol required for deposit", 400);
        }
        if (!PROTOCOLS[protocol]) {
          return this.errorResponse(c, `Unknown protocol: ${protocol}`, 400);
        }
        payload = buildDepositPayload(protocol, amount);
        simulation = {
          from: sender,
          to: `${PROTOCOLS[protocol].address}.${PROTOCOLS[protocol].name}`,
          amount: `${amount} sBTC`,
          action: "Deposit into yield protocol",
          expectedResult: "Receive LP tokens or staked position",
        };
        break;

      case "withdraw":
        if (!protocol) {
          return this.errorResponse(c, "protocol required for withdraw", 400);
        }
        if (!PROTOCOLS[protocol]) {
          return this.errorResponse(c, `Unknown protocol: ${protocol}`, 400);
        }
        payload = buildWithdrawPayload(protocol, amount);
        simulation = {
          from: `${PROTOCOLS[protocol].address}.${PROTOCOLS[protocol].name}`,
          to: sender,
          amount: `${amount} sBTC`,
          action: "Withdraw from yield protocol",
          expectedResult: "Receive sBTC to wallet",
        };
        break;

      case "swap":
        payload = buildSwapPayload(amount, "sBTC", toAsset, slippage);
        simulation = {
          from: sender,
          sell: `${amount} sBTC`,
          buy: `~${(amount * 50000).toFixed(2)} ${toAsset}`, // Rough estimate
          venue: "ALEX DEX",
          slippage: `${slippage}%`,
          minReceived: payload.minReceived,
        };
        break;

      default:
        return this.errorResponse(c, `Unknown action: ${action}`, 400);
    }

    // Build complete transaction data
    const txData = {
      network: "mainnet",
      anchorMode: "any",
      postConditionMode: "deny", // Strict mode for safety
      ...payload,
    };

    return c.json({
      action,
      payload: txData,
      simulation,
      instructions: {
        step1: "Review the payload and simulation",
        step2: "Sign the transaction with your private key",
        step3: "Broadcast to Stacks network via /v2/transactions",
        step4: "Monitor transaction status via txid",
      },
      warnings: action === "swap" ? [
        "Swap rates are estimates - actual rate determined at execution",
        "Ensure sufficient STX for transaction fees",
        `Slippage tolerance: ${slippage}% - transaction fails if price moves more`,
      ] : [
        "Ensure sufficient STX for transaction fees",
        "Verify recipient/protocol address before signing",
      ],
      timestamp: new Date().toISOString(),
      tokenType,
    });
  }
}
