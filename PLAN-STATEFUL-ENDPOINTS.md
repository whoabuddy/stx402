# Stateful Endpoints Implementation Plan

## Overview

Add transactional stateful endpoints using Cloudflare KV and Durable Objects, enabling AI agents to store data, coordinate work, and maintain state across sessions - all paid per-operation via X402.

## Cloudflare Limits Reference

### KV Limits
- **Key size**: 512 bytes max
- **Value size**: 25 MB max (recommend 1MB practical limit)
- **TTL**: 60 seconds minimum, no maximum
- **List**: Supports prefix filtering (1000 keys per call)
- **Operations**: Eventually consistent reads, strong consistency on writes

### Durable Objects Limits
- **Storage per object**: Unlimited (50GB per namespace)
- **Key size**: 2 KB max
- **Value size**: 128 KB max per key
- **Transactions**: ACID guarantees within single object
- **SQL**: Supports SQL-like queries on stored data

---

## Namespace Strategy

### KV Key Format
```
{category}:{visibility}:{owner}:{key}
```

Examples:
- `kv:private:SP123...ABC:my-config` - Private to owner
- `kv:public:SP123...ABC:shared-data` - Readable by anyone who knows key
- `paste:public:SP123...ABC:abc123` - Public paste with short code
- `memo:private:SP123...ABC:sha256:input-hash` - Memoized result

### Durable Object ID Format
```
{type}:{owner}:{name}
```

Examples:
- `counter:SP123...ABC:page-views` - Counter owned by address
- `link:SP123...ABC:abc123` - URL shortener entry
- `lock:SP123...ABC:deployment` - Named lock
- `queue:SP123...ABC:jobs` - Job queue

### Benefits
1. **Automatic isolation**: Owner prefix = data isolation by payer
2. **Prefix queries**: `kv:private:SP123...` lists all private keys for owner
3. **Public sharing**: `visibility:public` allows cross-owner access
4. **Efficient cleanup**: Delete by prefix when needed

---

## New Pricing Tiers

```typescript
// Add to src/utils/pricing.ts
export type PricingTier =
  | "simple" | "ai" | "heavy_ai"
  | "storage_read" | "storage_write" | "storage_write_large" | "storage_ai";

export const TIER_AMOUNTS: Record<PricingTier, Record<TokenType, string>> = {
  // Existing tiers...

  // New storage tiers
  storage_read: {
    STX: "0.0005",      // Half of simple - reads are cheap
    sBTC: "0.0000005",
    USDCx: "0.0005",
  },
  storage_write: {
    STX: "0.001",       // Same as simple - standard write
    sBTC: "0.000001",
    USDCx: "0.001",
  },
  storage_write_large: {
    STX: "0.005",       // 5x simple - for values > 100KB
    sBTC: "0.000005",
    USDCx: "0.005",
  },
  storage_ai: {
    STX: "0.003",       // Same as ai - semantic search, etc.
    sBTC: "0.000003",
    USDCx: "0.003",
  },
};
```

### Size-Based Pricing Logic
```typescript
function getStorageWriteTier(valueSize: number): PricingTier {
  if (valueSize > 100 * 1024) return "storage_write_large";  // > 100KB
  return "storage_write";
}
```

---

## Implementation Phases

### Phase 1: KV Foundation (4 endpoints) ✅ COMPLETED
**New category**: `/api/kv/*`

| Endpoint | Method | Tier | Description |
|----------|--------|------|-------------|
| `/api/kv/set` | POST | storage_write[_large] | Store value with optional TTL |
| `/api/kv/get` | POST | storage_read | Retrieve value by key |
| `/api/kv/delete` | POST | storage_write | Delete key |
| `/api/kv/list` | POST | storage_read | List keys by prefix |

**Request/Response Specs:**

```typescript
// POST /api/kv/set
{
  key: string,           // Max 256 chars (we reserve prefix space)
  value: string | object,// Max 1MB (or 25MB for large tier)
  ttl?: number,          // Seconds, min 60, default 86400 (1 day)
  visibility?: "private" | "public"  // Default: private
}
// Response: { success: true, key: string, expiresAt?: string }

// POST /api/kv/get
{
  key: string,
  owner?: string         // For public keys, specify owner address
}
// Response: { key, value, expiresAt?, visibility }

// POST /api/kv/delete
{
  key: string
}
// Response: { success: true, deleted: string }

// POST /api/kv/list
{
  prefix?: string,       // Filter by key prefix
  limit?: number,        // Max 1000, default 100
  cursor?: string        // Pagination cursor
}
// Response: { keys: string[], cursor?: string, complete: boolean }
```

**Wrangler Changes:**
```jsonc
// Add new KV namespace for user storage
"kv_namespaces": [
  { "binding": "METRICS", ... },
  { "binding": "STORAGE", "id": "...", "preview_id": "..." }
]
```

---

### Phase 2: Paste Service (3 endpoints) ✅ COMPLETED
**Category**: `/api/paste/*`

| Endpoint | Method | Tier | Description |
|----------|--------|------|-------------|
| `/api/paste/create` | POST | storage_write | Store text, get short code |
| `/api/paste/get` | GET | storage_read | Retrieve by code |
| `/api/paste/delete` | POST | storage_write | Delete paste |

**Features:**
- Auto-generate 6-char alphanumeric codes
- Default TTL: 7 days, max: 30 days
- Syntax highlighting hint (optional `language` field)
- Always public (that's the point of paste)

```typescript
// POST /api/paste/create
{
  content: string,       // Max 500KB
  language?: string,     // "javascript", "python", etc.
  ttl?: number           // Seconds, default 604800 (7 days)
}
// Response: { code: "abc123", url: "https://stx402.com/p/abc123", expiresAt }

// GET /api/paste/get?code=abc123
// Response: { code, content, language?, createdAt, expiresAt }
```

---

### Phase 3: Counters + SQL (Durable Objects) (9 endpoints) ✅ COMPLETED
**Category**: `/api/counter/*` + `/api/sql/*`

**Actual Implementation** - Counter (6 endpoints) + SQL (3 endpoints):

| Endpoint | Method | Tier | Description |
|----------|--------|------|-------------|
| `/api/counter/increment` | POST | storage_write | Atomic increment |
| `/api/counter/decrement` | POST | storage_write | Atomic decrement |
| `/api/counter/get` | POST | storage_read | Get current value |
| `/api/counter/reset` | POST | storage_write | Reset to zero |

**Features:**
- Atomic operations (Durable Objects guarantee)
- Optional min/max bounds
- Optional step size

```typescript
// POST /api/counter/increment
{
  name: string,          // Counter name
  step?: number,         // Default 1
  max?: number           // Optional ceiling
}
// Response: { name, value: number, previousValue: number }

// POST /api/counter/get
{
  name: string
}
// Response: { name, value: number, updatedAt: string }
```

**Wrangler Changes:**
```jsonc
"durable_objects": {
  "bindings": [
    { "name": "COUNTER", "class_name": "CounterDO" }
  ]
}
```

---

### Phase 4: URL Shortener (5 endpoints) ✅ COMPLETED
**Category**: `/api/links/*`

| Endpoint | Method | Tier | Description |
|----------|--------|------|-------------|
| `/api/links/create` | POST | storage_write | Create short link |
| `/api/links/expand/:slug` | GET | **free** | Resolve and redirect (tracks clicks) |
| `/api/links/stats` | POST | storage_read | Get click statistics |
| `/api/links/delete` | POST | storage_write | Delete link |
| `/api/links/list` | GET | storage_read | List all links |

**Features:**
- Custom slugs (optional)
- Click tracking with timestamps
- Referrer and country tracking
- Optional title/metadata
- Optional expiration (TTL)
- Per-user isolation via Durable Objects

```typescript
// POST /api/links/create
{
  url: string,           // Target URL
  slug?: string,         // Custom slug (optional, 3-32 chars)
  title?: string,        // Link title/description
  ttl?: number           // Seconds until expiration (optional)
}
// Response: { slug, shortUrl, url, title?, expiresAt? }

// POST /api/links/stats
{
  slug: string
}
// Response: { slug, url, clicks, createdAt, lastClickAt?, referrers, recentClicks }

// GET /api/links/list
// Response: { links: [...], count }
```

---

### Phase 5: Distributed Locks (5 endpoints) ✅ COMPLETED
**Category**: `/api/sync/*`

| Endpoint | Method | Tier | Description |
|----------|--------|------|-------------|
| `/api/sync/lock` | POST | storage_write | Acquire named lock |
| `/api/sync/unlock` | POST | storage_write | Release lock |
| `/api/sync/check` | POST | storage_read | Check lock status |
| `/api/sync/extend` | POST | storage_write | Extend lock TTL |

**Features:**
- Automatic expiration (prevents deadlocks)
- Lock token for secure release
- Wait/retry with timeout option

```typescript
// POST /api/sync/lock
{
  name: string,          // Lock name
  ttl?: number,          // Seconds, default 60, max 300
  wait?: boolean,        // Wait for lock if held? Default false
  timeout?: number       // Max wait time in ms
}
// Response: { acquired: true, token: string, expiresAt }
//        or { acquired: false, holder?: string, expiresAt }

// POST /api/sync/unlock
{
  name: string,
  token: string          // Must match token from acquire
}
// Response: { released: true }
```

---

### Phase 6: Job Queue (5 endpoints) ✅ COMPLETED
**Category**: `/api/queue/*`

| Endpoint | Method | Tier | Description |
|----------|--------|------|-------------|
| `/api/queue/push` | POST | storage_write | Add job to queue |
| `/api/queue/pop` | POST | storage_write | Claim next job |
| `/api/queue/complete` | POST | storage_write | Mark job done |
| `/api/queue/fail` | POST | storage_write | Mark job failed |
| `/api/queue/status` | POST | storage_read | Get queue stats |

**Features:**
- Named queues per owner
- Priority support
- Retry with backoff
- Dead letter queue for failed jobs
- Job visibility timeout

```typescript
// POST /api/queue/push
{
  queue: string,         // Queue name
  payload: any,          // Job data
  priority?: number,     // Higher = sooner, default 0
  delay?: number         // Seconds to wait before available
}
// Response: { jobId, queue, position }

// POST /api/queue/pop
{
  queue: string,
  visibility?: number    // Seconds before job becomes available again
}
// Response: { jobId, payload, attempt: number } or { empty: true }
```

---

### Phase 7: Agent Memory System (5 endpoints)
**Category**: `/api/memory/*`

| Endpoint | Method | Tier | Description |
|----------|--------|------|-------------|
| `/api/memory/store` | POST | storage_write | Store memory with metadata |
| `/api/memory/recall` | POST | storage_read | Retrieve by key |
| `/api/memory/search` | POST | storage_ai | Semantic search |
| `/api/memory/list` | POST | storage_read | List memories |
| `/api/memory/forget` | POST | storage_write | Delete memory |

**Features:**
- Rich metadata (tags, type, source)
- Embedding generation for semantic search
- Automatic summarization for long content
- Importance scoring

```typescript
// POST /api/memory/store
{
  key: string,
  content: string,
  metadata?: {
    tags?: string[],
    type?: "fact" | "conversation" | "task" | "note",
    importance?: number,  // 0-10
    source?: string
  },
  ttl?: number
}
// Response: { key, stored: true, embedding?: boolean }

// POST /api/memory/search
{
  query: string,         // Natural language query
  limit?: number,        // Default 10
  filter?: {
    tags?: string[],
    type?: string,
    minImportance?: number
  }
}
// Response: { results: [{ key, content, similarity, metadata }] }
```

---

## What Stays, What Changes

### Keep All Existing Endpoints
All 116 current endpoints remain unchanged. They're stateless utilities that complement the new stateful endpoints:

- **Text/Data**: Transform data before storing
- **Crypto**: Hash values for keys/deduplication
- **Random**: Generate unique IDs, slugs
- **Utility**: Parse URLs before shortening, generate QR codes

### New Integration Opportunities

1. **QR + Links**: `/api/links/create` can return QR code (uses existing QR logic)
2. **Hash + Memo**: Memoization can use hash endpoints for cache keys
3. **Summarize + Memory**: Auto-summarize long content before storing

### Potential Deprecation Candidates (Future)
None immediately. Monitor usage to see if patterns emerge where stateful versions are preferred.

---

## Wrangler Configuration Changes

```jsonc
{
  "kv_namespaces": [
    { "binding": "METRICS", "id": "...", "preview_id": "..." },
    { "binding": "STORAGE", "id": "...", "preview_id": "..." }
  ],
  "durable_objects": {
    "bindings": [
      { "name": "COUNTER", "class_name": "CounterDO" },
      { "name": "LINK", "class_name": "LinkDO" },
      { "name": "LOCK", "class_name": "LockDO" },
      { "name": "QUEUE", "class_name": "QueueDO" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_classes": ["CounterDO", "LinkDO", "LockDO", "QueueDO"] }
  ]
}
```

---

## Implementation Order & Dependencies

```
Phase 1: KV Foundation ──────────────────────────┐
    └── Phase 2: Paste (uses KV) ────────────────┤
                                                 │
Phase 3: Counters (first DO) ────────────────────┤
    └── Phase 4: Links (DO + stats) ─────────────┤
                                                 │
Phase 5: Locks (DO) ─────────────────────────────┤
    └── Phase 6: Queue (DO + complex state) ─────┤
                                                 │
Phase 7: Memory (KV + AI + Embeddings) ──────────┘
```

### Per-Phase Deliverables
1. Endpoint implementations
2. Tests for each endpoint
3. Pricing tier updates
4. Documentation updates
5. CLAUDE.md updates

---

## File Structure (New)

```
src/
├── endpoints/
│   ├── kv/
│   │   ├── kvSet.ts
│   │   ├── kvGet.ts
│   │   ├── kvDelete.ts
│   │   └── kvList.ts
│   ├── paste/
│   │   ├── pasteCreate.ts
│   │   ├── pasteGet.ts
│   │   └── pasteDelete.ts
│   ├── counter/
│   │   ├── counterIncrement.ts
│   │   ├── counterDecrement.ts
│   │   ├── counterGet.ts
│   │   └── counterReset.ts
│   ├── links/
│   │   ├── linksCreate.ts
│   │   ├── linksExpand.ts
│   │   ├── linksStats.ts
│   │   └── linksDelete.ts
│   ├── sync/
│   │   ├── syncLock.ts
│   │   ├── syncUnlock.ts
│   │   ├── syncCheck.ts
│   │   └── syncExtend.ts
│   ├── queue/
│   │   ├── queuePush.ts
│   │   ├── queuePop.ts
│   │   ├── queueComplete.ts
│   │   ├── queueFail.ts
│   │   └── queueStatus.ts
│   └── memory/
│       ├── memoryStore.ts
│       ├── memoryRecall.ts
│       ├── memorySearch.ts
│       ├── memoryList.ts
│       └── memoryForget.ts
├── durable-objects/
│   ├── CounterDO.ts
│   ├── LinkDO.ts
│   ├── LockDO.ts
│   └── QueueDO.ts
└── utils/
    └── namespace.ts      # Key formatting helpers
```

---

## Summary

| Phase | Category | Endpoints | Storage | Status |
|-------|----------|-----------|---------|--------|
| 1 | `/api/kv/*` | 4 | KV | ✅ Done |
| 2 | `/api/paste/*` | 3 | KV | ✅ Done |
| 3 | `/api/counter/*` + `/api/sql/*` | 6+3=9 | DO | ✅ Done |
| 4 | `/api/links/*` | 5 | DO | ✅ Done |
| 5 | `/api/sync/*` | 5 | DO | ✅ Done |
| 6 | `/api/queue/*` | 5 | DO | ✅ Done |
| 7 | `/api/memory/*` | 5 | KV+AI | Planned |

**Completed**: 31 endpoints (Phases 1-6)
**Current total**: 147 endpoints (116 original + 31 stateful)

---

## Open Questions

1. **Rate limiting per owner?** Should we add soft limits to prevent abuse?
2. **Storage quotas?** Max total storage per address?
3. **Cross-owner sharing model?** Beyond public/private, need ACLs?
4. **Backup/export?** Allow users to export all their data?

---

Ready to begin Phase 1 when you are.
