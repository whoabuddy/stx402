import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

// Registry entry status
export type RegistryStatus = "unverified" | "verified" | "rejected";

// Required fields for registration
export interface RegistryEntryRequired {
  url: string;
  name: string;
  description: string;
  owner: string; // STX address
}

// X402 probe data stored with each entry
export interface X402ProbeData {
  paymentAddress: string;
  acceptedTokens: string[];
  prices: Record<string, string>;
  responseTimeMs: number;
  supportedMethods: string[];
  openApiSchema?: Record<string, unknown>;
  probeTimestamp: string;
}

// Full registry entry
export interface RegistryEntry extends RegistryEntryRequired {
  id: string; // urlHash
  status: RegistryStatus;
  category?: string;
  tags?: string[];
  probeData?: X402ProbeData;
  registeredAt: string;
  updatedAt: string;
  registeredBy: string; // Address that paid to register (may differ from owner)
}

// Minimal entry for list endpoint (free)
export interface RegistryEntryMinimal {
  id: string;
  url: string;
  name: string;
  category?: string;
  status: RegistryStatus;
  owner: string;
  registeredAt: string;
  updatedAt: string;
}

// Index entry for lookups
export interface RegistryIndexEntry {
  owner: string;
  urlHash: string;
  status: RegistryStatus;
  name: string;
  category?: string;
}

// Generate a URL hash for use as ID
export function generateUrlHash(url: string): string {
  const hash = sha256(new TextEncoder().encode(url));
  return bytesToHex(hash).substring(0, 16); // 16 chars is enough for uniqueness
}

// KV key helpers
export const RegistryKeys = {
  // Full entry: registry:owner:{address}:{urlHash}
  entry: (owner: string, urlHash: string) => `registry:owner:${owner}:${urlHash}`,

  // Parse owner and urlHash from key
  parseEntryKey: (key: string): { owner: string; urlHash: string } | null => {
    const match = key.match(/^registry:owner:([^:]+):([^:]+)$/);
    if (!match) return null;
    return { owner: match[1], urlHash: match[2] };
  },

  // Index of all entries (list of owner:urlHash pairs)
  indexAll: () => "registry:index:all",

  // Lookup by URL hash
  urlLookup: (urlHash: string) => `registry:lookup:url:${urlHash}`,

  // Index by category
  indexCategory: (category: string) => `registry:index:category:${category.toLowerCase()}`,

  // Index by status (for admin listing pending)
  indexStatus: (status: RegistryStatus) => `registry:index:status:${status}`,

  // Owner prefix for listing all entries by owner
  ownerPrefix: (owner: string) => `registry:owner:${owner}:`,
};

// Get a registry entry by owner and urlHash
export async function getRegistryEntry(
  kv: KVNamespace,
  owner: string,
  urlHash: string
): Promise<RegistryEntry | null> {
  const key = RegistryKeys.entry(owner, urlHash);
  const data = await kv.get(key);
  if (!data) return null;
  return JSON.parse(data) as RegistryEntry;
}

// Get entry by URL (lookup table)
export async function getRegistryEntryByUrl(
  kv: KVNamespace,
  url: string
): Promise<RegistryEntry | null> {
  const urlHash = generateUrlHash(url);
  const lookupKey = RegistryKeys.urlLookup(urlHash);
  const ownerData = await kv.get(lookupKey);
  if (!ownerData) return null;

  const { owner } = JSON.parse(ownerData) as { owner: string };
  return getRegistryEntry(kv, owner, urlHash);
}

// Save a registry entry
export async function saveRegistryEntry(
  kv: KVNamespace,
  entry: RegistryEntry
): Promise<void> {
  const urlHash = entry.id;
  const entryKey = RegistryKeys.entry(entry.owner, urlHash);
  const lookupKey = RegistryKeys.urlLookup(urlHash);

  // Save entry
  await kv.put(entryKey, JSON.stringify(entry));

  // Save URL lookup
  await kv.put(lookupKey, JSON.stringify({ owner: entry.owner }));

  // Update indexes
  await updateIndexes(kv, entry);
}

// Update indexes when entry changes
async function updateIndexes(kv: KVNamespace, entry: RegistryEntry): Promise<void> {
  const indexEntry: RegistryIndexEntry = {
    owner: entry.owner,
    urlHash: entry.id,
    status: entry.status,
    name: entry.name,
    category: entry.category,
  };

  // Get current all-index
  const allIndexKey = RegistryKeys.indexAll();
  const allIndexData = await kv.get(allIndexKey);
  let allIndex: RegistryIndexEntry[] = allIndexData ? JSON.parse(allIndexData) : [];

  // Update or add entry in all-index
  const existingIdx = allIndex.findIndex(
    (e) => e.owner === entry.owner && e.urlHash === entry.id
  );
  if (existingIdx >= 0) {
    allIndex[existingIdx] = indexEntry;
  } else {
    allIndex.push(indexEntry);
  }

  await kv.put(allIndexKey, JSON.stringify(allIndex));

  // Update status index
  const statusKey = RegistryKeys.indexStatus(entry.status);
  const statusData = await kv.get(statusKey);
  let statusIndex: string[] = statusData ? JSON.parse(statusData) : [];
  const entryId = `${entry.owner}:${entry.id}`;

  // Remove from old status indexes
  for (const status of ["unverified", "verified", "rejected"] as RegistryStatus[]) {
    if (status !== entry.status) {
      const oldStatusKey = RegistryKeys.indexStatus(status);
      const oldData = await kv.get(oldStatusKey);
      if (oldData) {
        const oldIndex: string[] = JSON.parse(oldData);
        const filtered = oldIndex.filter((id) => id !== entryId);
        if (filtered.length !== oldIndex.length) {
          await kv.put(oldStatusKey, JSON.stringify(filtered));
        }
      }
    }
  }

  // Add to current status index
  if (!statusIndex.includes(entryId)) {
    statusIndex.push(entryId);
    await kv.put(statusKey, JSON.stringify(statusIndex));
  }

  // Update category index if category exists
  if (entry.category) {
    const catKey = RegistryKeys.indexCategory(entry.category);
    const catData = await kv.get(catKey);
    let catIndex: string[] = catData ? JSON.parse(catData) : [];
    if (!catIndex.includes(entryId)) {
      catIndex.push(entryId);
      await kv.put(catKey, JSON.stringify(catIndex));
    }
  }
}

// List all registry entries (minimal data for free endpoint)
export async function listAllEntries(
  kv: KVNamespace,
  options?: { category?: string; status?: RegistryStatus; limit?: number; offset?: number }
): Promise<{ entries: RegistryEntryMinimal[]; total: number }> {
  const allIndexKey = RegistryKeys.indexAll();
  const allIndexData = await kv.get(allIndexKey);

  if (!allIndexData) {
    return { entries: [], total: 0 };
  }

  let allIndex: RegistryIndexEntry[] = JSON.parse(allIndexData);

  // Filter by category
  if (options?.category) {
    allIndex = allIndex.filter(
      (e) => e.category?.toLowerCase() === options.category?.toLowerCase()
    );
  }

  // Filter by status
  if (options?.status) {
    allIndex = allIndex.filter((e) => e.status === options.status);
  }

  const total = allIndex.length;

  // Apply pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || 50;
  const paged = allIndex.slice(offset, offset + limit);

  // Fetch minimal data for each entry
  const entries: RegistryEntryMinimal[] = [];
  for (const idx of paged) {
    const entry = await getRegistryEntry(kv, idx.owner, idx.urlHash);
    if (entry) {
      entries.push({
        id: entry.id,
        url: entry.url,
        name: entry.name,
        category: entry.category,
        status: entry.status,
        owner: entry.owner,
        registeredAt: entry.registeredAt,
        updatedAt: entry.updatedAt,
      });
    }
  }

  return { entries, total };
}

// List entries by owner
export async function listEntriesByOwner(
  kv: KVNamespace,
  owner: string
): Promise<RegistryEntry[]> {
  const prefix = RegistryKeys.ownerPrefix(owner);
  const list = await kv.list({ prefix });

  const entries: RegistryEntry[] = [];
  for (const key of list.keys) {
    const data = await kv.get(key.name);
    if (data) {
      entries.push(JSON.parse(data) as RegistryEntry);
    }
  }

  return entries;
}

// List entries by status (for admin)
export async function listEntriesByStatus(
  kv: KVNamespace,
  status: RegistryStatus
): Promise<RegistryEntry[]> {
  const statusKey = RegistryKeys.indexStatus(status);
  const statusData = await kv.get(statusKey);

  if (!statusData) return [];

  const entryIds: string[] = JSON.parse(statusData);
  const entries: RegistryEntry[] = [];

  for (const entryId of entryIds) {
    const [owner, urlHash] = entryId.split(":");
    const entry = await getRegistryEntry(kv, owner, urlHash);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

// Delete a registry entry
export async function deleteRegistryEntry(
  kv: KVNamespace,
  owner: string,
  urlHash: string
): Promise<boolean> {
  const entry = await getRegistryEntry(kv, owner, urlHash);
  if (!entry) return false;

  // Delete main entry
  await kv.delete(RegistryKeys.entry(owner, urlHash));

  // Delete URL lookup
  await kv.delete(RegistryKeys.urlLookup(urlHash));

  // Remove from all-index
  const allIndexKey = RegistryKeys.indexAll();
  const allIndexData = await kv.get(allIndexKey);
  if (allIndexData) {
    const allIndex: RegistryIndexEntry[] = JSON.parse(allIndexData);
    const filtered = allIndex.filter(
      (e) => !(e.owner === owner && e.urlHash === urlHash)
    );
    await kv.put(allIndexKey, JSON.stringify(filtered));
  }

  // Remove from status index
  const statusKey = RegistryKeys.indexStatus(entry.status);
  const statusData = await kv.get(statusKey);
  if (statusData) {
    const statusIndex: string[] = JSON.parse(statusData);
    const entryId = `${owner}:${urlHash}`;
    const filtered = statusIndex.filter((id) => id !== entryId);
    await kv.put(statusKey, JSON.stringify(filtered));
  }

  // Remove from category index
  if (entry.category) {
    const catKey = RegistryKeys.indexCategory(entry.category);
    const catData = await kv.get(catKey);
    if (catData) {
      const catIndex: string[] = JSON.parse(catData);
      const entryId = `${owner}:${urlHash}`;
      const filtered = catIndex.filter((id) => id !== entryId);
      await kv.put(catKey, JSON.stringify(filtered));
    }
  }

  return true;
}

// Update entry status (for admin)
export async function updateEntryStatus(
  kv: KVNamespace,
  owner: string,
  urlHash: string,
  status: RegistryStatus
): Promise<RegistryEntry | null> {
  const entry = await getRegistryEntry(kv, owner, urlHash);
  if (!entry) return null;

  entry.status = status;
  entry.updatedAt = new Date().toISOString();

  await saveRegistryEntry(kv, entry);
  return entry;
}
