import { BTCtoSats, STXtoMicroSTX } from "x402-stacks";

export type TokenType = "STX" | "sBTC" | "USDCx";

const DEFAULT_AMOUNTS: Record<TokenType, string> = {
  STX: "0.003",
  sBTC: "0.000001",
  USDCx: "0.001",
};

export function validateTokenType(tokenTypeStr: string): TokenType {
  const upper = tokenTypeStr.toUpperCase() as TokenType;
  const validTokens: TokenType[] = ["STX", "sBTC", "USDCx"];
  if (validTokens.includes(upper)) {
    return upper;
  }
  throw new Error(`Invalid tokenType: ${tokenTypeStr}. Supported: ${validTokens.join(", ")}`);
}

export function getPaymentAmount(tokenType: TokenType): bigint {
  const amountStr = DEFAULT_AMOUNTS[tokenType];
  const amountNum = parseFloat(amountStr);
  switch (tokenType) {
    case "STX":
      return STXtoMicroSTX(amountStr);
    case "sBTC":
      return BTCtoSats(amountNum);
    case "USDCx":
      return BigInt(Math.floor(amountNum * 1e6)); // to micro-USD
    default:
      throw new Error(`Unknown tokenType: ${tokenType}`);
  }
}
