import { getNetworkFromPrincipal } from "./network";

const API_URLS: Record<string, string> = {
  mainnet: "https://api.mainnet.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

interface BnsNamesResponse {
  names: string[];
}

/**
 * Get BNS name for a Stacks address using Hiro API
 * Returns the first/primary name or empty string if none found
 */
export async function getNameFromAddress(address: string): Promise<string> {
  const network = getNetworkFromPrincipal(address);
  const apiUrl = API_URLS[network];

  const response = await fetch(
    `${apiUrl}/v1/addresses/stacks/${address}`,
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return "";
    }
    throw new Error(`BNS API error: ${response.status}`);
  }

  const data = await response.json() as BnsNamesResponse;

  // Return the first name (primary) or empty string
  return data.names?.[0] || "";
}
