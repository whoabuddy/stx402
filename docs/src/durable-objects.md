---
title: durable-objects
layout: default
parent: src
nav_order: 3
---

[← src](../src.md) | **durable-objects**

# durable-objects

> Per-user SQLite-backed Durable Object for URL shortener storage.

## Contents

| Item | Purpose |
|------|---------|
| [`UserDurableObject.ts`](https://github.com/whoabuddy/stx402/blob/master/src/durable-objects/UserDurableObject.ts) | Per-user DO for links (URL shortener) |

## Design Principles

Per Cloudflare best practices:

1. **SQLite over KV** - Use structured storage for relational data
2. **RPC methods** - Clean interface for endpoint handlers
3. **blockConcurrencyWhile** - Schema initialized once in constructor before any requests
4. **User isolation** - Each payer address gets own DO instance

## Schema

```sql
CREATE TABLE links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  clicked_at TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  FOREIGN KEY (slug) REFERENCES links(slug) ON DELETE CASCADE
);
```

## RPC Methods

```typescript
// Links
await do.linkCreate(slug, url, title?, expiresAt?);
await do.linkGet(slug);
await do.linkRecordClick(slug, referrer?, userAgent?, country?);
await do.linkStats(slug);
await do.linkDelete(slug);
await do.linkList();
```

## Usage Pattern

```typescript
// Get DO stub for payer address
const id = c.env.USER_DO.idFromName(payerAddress);
const stub = c.env.USER_DO.get(id);

// Call RPC method
const result = await stub.linkCreate("my-slug", "https://example.com");
```

## Relationships

- **Consumed by**: Links endpoints (`links/`)
- **Bound in**: `wrangler.jsonc` as `USER_DO` Durable Object binding

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/durable-objects)*
