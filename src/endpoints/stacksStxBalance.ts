import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { getNetworkFromPrincipal } from "../utils/network";

const API_URLS: Record<string, string> = {
  mainnet: "https://api.mainnet.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

interface AccountBalance {
  stx: {
    balance: string;
    total_sent: string;
    total_received: string;
    lock_tx_id: string;
    locked: string;
    lock_height: number;
    burnchain_lock_height: number;
    burnchain_unlock_height: number;
  };
  nonce: number;
}

export class StacksStxBalance extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get STX balance for an address",
    parameters: [
      {
        name: "address",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Stacks address",
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
        description: "STX balance info",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const },
                balance: { type: "string" as const, description: "Balance in microSTX" },
                balanceFormatted: { type: "string" as const, description: "Balance in STX" },
                locked: { type: "string" as const, description: "Locked STX (stacking)" },
                totalSent: { type: "string" as const },
                totalReceived: { type: "string" as const },
                nonce: { type: "integer" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid address",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const address = c.req.param("address");

    if (!address) {
      return this.errorResponse(c, "address parameter is required", 400);
    }

    let network: string;
    try {
      network = getNetworkFromPrincipal(address);
    } catch {
      return this.errorResponse(c, "Invalid Stacks address", 400);
    }

    const apiUrl = API_URLS[network];

    try {
      const response = await fetch(`${apiUrl}/extended/v1/address/${address}/stx`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Address exists but has no transactions
          return c.json({
            address,
            balance: "0",
            balanceFormatted: "0.000000",
            locked: "0",
            totalSent: "0",
            totalReceived: "0",
            nonce: 0,
            network,
            tokenType,
          });
        }
        return this.errorResponse(c, `API error: ${response.status}`, 500);
      }

      const data = await response.json() as AccountBalance;

      // Defensive check for API response structure
      if (!data || !data.stx) {
        return c.json({
          address,
          balance: "0",
          balanceFormatted: "0.000000",
          locked: "0",
          totalSent: "0",
          totalReceived: "0",
          nonce: 0,
          network,
          tokenType,
        });
      }

      // Format balance to STX (6 decimal places)
      const balanceMicro = BigInt(data.stx.balance || "0");
      const balanceStx = Number(balanceMicro) / 1_000_000;

      return c.json({
        address,
        balance: data.stx.balance || "0",
        balanceFormatted: balanceStx.toFixed(6),
        locked: data.stx.locked || "0",
        totalSent: data.stx.total_sent || "0",
        totalReceived: data.stx.total_received || "0",
        nonce: data.nonce || 0,
        lockHeight: data.stx.lock_height || null,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to fetch balance: ${String(error)}`, 500);
    }
  }
}
