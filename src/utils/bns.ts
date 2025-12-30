import { getNetworkFromPrincipal } from "./network";
import { hiroFetch, getHiroApiUrl } from "./hiro";

interface BnsNamesResponse {
  names: string[];
}

/**
 * Get BNS name for a Stacks address using Hiro API
 * Returns the first/primary name or empty string if none found
 * Throws HiroRateLimitError if rate limited (429)
 */
export async function getNameFromAddress(address: string): Promise<string> {
  const network = getNetworkFromPrincipal(address);
  const apiUrl = getHiroApiUrl(network as "mainnet" | "testnet");

  const response = await hiroFetch(
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
