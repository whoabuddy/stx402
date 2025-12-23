/**
 * Converts a hex string to ASCII text
 *
 * @param hexString - Hex string or BigInt to convert
 * @returns ASCII string representation
 */
export function hexToAscii(hexString: string | bigint | Uint8Array): string {
  try {
    let hex: string;
    if (hexString instanceof Uint8Array) {
      hex = Buffer.from(hexString).toString("hex");
    } else {
      hex =
        typeof hexString === "bigint"
          ? hexString.toString(16)
          : hexString.replace("0x", "");
    }
    // Convert each pair of hex digits directly to ASCII
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  } catch (error) {
    console.error("Failed to convert hex to ASCII:", error, {
      hexString: String(hexString),
    });
    // Return empty string on error rather than throwing
    // This is more graceful for display purposes
    return "";
  }
}
