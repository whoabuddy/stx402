import {
  Cl,
  ClarityValue,
  encodeStructuredData,
  publicKeyFromSignatureRsv,
  cvToHex,
  publicKeyToAddress as stacksPublicKeyToAddress,
  Address,
} from "@stacks/transactions";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

// SIP-018 Domain for STX402 Registry
export const STX402_DOMAIN = Cl.tuple({
  name: Cl.stringAscii("stx402-registry"),
  version: Cl.stringAscii("1.0.0"),
  "chain-id": Cl.uint(1), // 1 for mainnet, will be overridden based on network
});

export function getDomain(network: "mainnet" | "testnet"): ClarityValue {
  return Cl.tuple({
    name: Cl.stringAscii("stx402-registry"),
    version: Cl.stringAscii("1.0.0"),
    "chain-id": Cl.uint(network === "mainnet" ? 1 : 2147483648), // testnet chain-id
  });
}

// Message types for different operations
export type SignedAction =
  | "delete-endpoint"
  | "list-my-endpoints"
  | "transfer-ownership"
  | "challenge-response";

// Create a structured message for an action
export function createActionMessage(
  action: SignedAction,
  data: {
    url?: string;
    owner: string;
    timestamp: number;
    nonce?: string;
    newOwner?: string;
  }
): ClarityValue {
  switch (action) {
    case "delete-endpoint":
      return Cl.tuple({
        action: Cl.stringAscii("delete-endpoint"),
        url: Cl.stringAscii(data.url || ""),
        owner: Cl.stringAscii(data.owner),
        timestamp: Cl.uint(data.timestamp),
      });

    case "list-my-endpoints":
      return Cl.tuple({
        action: Cl.stringAscii("list-my-endpoints"),
        owner: Cl.stringAscii(data.owner),
        timestamp: Cl.uint(data.timestamp),
      });

    case "transfer-ownership":
      return Cl.tuple({
        action: Cl.stringAscii("transfer-ownership"),
        url: Cl.stringAscii(data.url || ""),
        owner: Cl.stringAscii(data.owner),
        "new-owner": Cl.stringAscii(data.newOwner || ""),
        timestamp: Cl.uint(data.timestamp),
      });

    case "challenge-response":
      return Cl.tuple({
        action: Cl.stringAscii("challenge-response"),
        owner: Cl.stringAscii(data.owner),
        nonce: Cl.stringAscii(data.nonce || ""),
        timestamp: Cl.uint(data.timestamp),
      });

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Generate a challenge nonce for sensitive operations
export function generateChallenge(): { nonce: string; expiresAt: number } {
  const nonce = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  return { nonce, expiresAt };
}

// Store for active challenges (in-memory, will reset on worker restart)
// For production, consider using KV storage
const activeChallenges = new Map<string, { nonce: string; expiresAt: number; owner: string }>();

export function storeChallenge(
  challengeId: string,
  challenge: { nonce: string; expiresAt: number; owner: string }
): void {
  // Clean up expired challenges
  const now = Date.now();
  for (const [id, c] of activeChallenges.entries()) {
    if (c.expiresAt < now) {
      activeChallenges.delete(id);
    }
  }
  activeChallenges.set(challengeId, challenge);
}

export function getChallenge(
  challengeId: string
): { nonce: string; expiresAt: number; owner: string } | null {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) return null;
  if (challenge.expiresAt < Date.now()) {
    activeChallenges.delete(challengeId);
    return null;
  }
  return challenge;
}

export function consumeChallenge(challengeId: string): boolean {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge || challenge.expiresAt < Date.now()) {
    activeChallenges.delete(challengeId);
    return false;
  }
  activeChallenges.delete(challengeId);
  return true;
}

// Verify a SIP-018 structured data signature
export function verifyStructuredSignature(
  message: ClarityValue,
  domain: ClarityValue,
  signature: string,
  expectedAddress: string,
  network: "mainnet" | "testnet" = "mainnet"
): { valid: boolean; recoveredAddress?: string; error?: string } {
  try {
    // Encode the structured data (prefix + domain hash + message hash)
    const encoded = encodeStructuredData({ message, domain });

    // Hash the encoded data to get the message hash for recovery
    const encodedBytes = hexToBytes(encoded);
    const messageHash = bytesToHex(sha256(encodedBytes));

    // Recover public key from signature
    const recoveredPubKey = publicKeyFromSignatureRsv(messageHash, signature);

    // Convert public key to address for both networks and check match
    const mainnetAddress = publicKeyToAddress(recoveredPubKey, "mainnet");
    const testnetAddress = publicKeyToAddress(recoveredPubKey, "testnet");

    // Compare addresses - check against both mainnet and testnet versions
    const valid = addressesMatch(mainnetAddress, expectedAddress) ||
                  addressesMatch(testnetAddress, expectedAddress);

    const recoveredAddress = network === "mainnet" ? mainnetAddress : testnetAddress;

    return {
      valid,
      recoveredAddress,
      error: valid ? undefined : "Recovered address does not match expected address",
    };
  } catch (error) {
    return {
      valid: false,
      error: `Signature verification failed: ${String(error)}`,
    };
  }
}

// Address version constants for c32check encoding
const ADDRESS_VERSION_MAINNET_SINGLE_SIG = 22; // SP prefix
const ADDRESS_VERSION_TESTNET_SINGLE_SIG = 26; // ST prefix

// Convert a compressed public key to a Stacks address
function publicKeyToAddress(publicKey: string, network: "mainnet" | "testnet" = "mainnet"): string {
  try {
    // Use the correct address version for c32check encoding
    // Note: TransactionVersion (0/128) is different from address version (22/26)
    const version = network === "mainnet"
      ? ADDRESS_VERSION_MAINNET_SINGLE_SIG
      : ADDRESS_VERSION_TESTNET_SINGLE_SIG;

    return stacksPublicKeyToAddress(version, publicKey);
  } catch (error) {
    console.error("Failed to convert public key to address:", error);
    throw error;
  }
}

// Check if two addresses match (handles mainnet/testnet variations)
function addressesMatch(addr1: string, addr2: string): boolean {
  // Normalize addresses - strip version prefix and compare the hash portion
  // SP/ST addresses have same hash160 just different version bytes
  try {
    const parsed1 = Address.parse(addr1);
    const parsed2 = Address.parse(addr2);

    // Compare the hash portion (the actual identity)
    return parsed1.hash160 === parsed2.hash160;
  } catch {
    return addr1.toLowerCase() === addr2.toLowerCase();
  }
}

// Verify a simple message signature (for basic auth)
export function verifySimpleSignature(
  message: string,
  signature: string,
  expectedAddress: string,
  network: "mainnet" | "testnet" = "mainnet"
): { valid: boolean; recoveredAddress?: string; error?: string } {
  try {
    // For simple messages, we hash the message directly
    const messageBytes = new TextEncoder().encode(message);
    const messageHash = bytesToHex(sha256(messageBytes));

    // Recover public key from signature
    const recoveredPubKey = publicKeyFromSignatureRsv(messageHash, signature);

    // Convert to address for both networks and check match
    const mainnetAddress = publicKeyToAddress(recoveredPubKey, "mainnet");
    const testnetAddress = publicKeyToAddress(recoveredPubKey, "testnet");

    const valid = addressesMatch(mainnetAddress, expectedAddress) ||
                  addressesMatch(testnetAddress, expectedAddress);

    const recoveredAddress = network === "mainnet" ? mainnetAddress : testnetAddress;

    return {
      valid,
      recoveredAddress,
      error: valid ? undefined : "Recovered address does not match expected address",
    };
  } catch (error) {
    return {
      valid: false,
      error: `Signature verification failed: ${String(error)}`,
    };
  }
}

// Validate timestamp is within acceptable range (prevents replay attacks)
export function isTimestampValid(
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes default
): boolean {
  const now = Date.now();
  const age = now - timestamp;

  // Timestamp should be in the past but not too old
  // Also reject future timestamps (with small tolerance for clock skew)
  return age >= -30000 && age <= maxAgeMs; // 30 second future tolerance
}

// Helper to format signature request data for client
export interface SignatureRequest {
  domain: string; // hex-encoded domain tuple
  message: string; // hex-encoded message tuple
  action: SignedAction;
  expiresAt: number;
  challengeId?: string;
}

export function createSignatureRequest(
  action: SignedAction,
  data: {
    url?: string;
    owner: string;
    newOwner?: string;
  },
  network: "mainnet" | "testnet",
  withChallenge: boolean = false
): SignatureRequest {
  const timestamp = Date.now();
  const domain = getDomain(network);

  let nonce: string | undefined;
  let challengeId: string | undefined;
  let expiresAt = timestamp + 5 * 60 * 1000; // 5 minutes

  if (withChallenge) {
    const challenge = generateChallenge();
    nonce = challenge.nonce;
    expiresAt = challenge.expiresAt;
    challengeId = crypto.randomUUID();
    storeChallenge(challengeId, { nonce, expiresAt, owner: data.owner });
  }

  const message = createActionMessage(action, {
    ...data,
    timestamp,
    nonce,
  });

  return {
    domain: cvToHex(domain),
    message: cvToHex(message),
    action,
    expiresAt,
    challengeId,
  };
}
