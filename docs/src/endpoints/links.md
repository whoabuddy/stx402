---
title: links
layout: default
parent: endpoints
grand_parent: src
nav_order: 2
---

[← endpoints](../endpoints.md) | **links**

# links

> URL shortener with click tracking via Durable Objects.

## Contents

| File | Purpose |
|------|---------|
| `linksCreate.ts` | Create short link |
| `linksExpand.ts` | Expand slug to URL |
| `linksStats.ts` | Get click statistics |
| `linksDelete.ts` | Delete a link |
| `linksList.ts` | List all links |
| `index.ts` | Exports all link endpoints |

## Endpoints

| Endpoint | Method | Tier | Purpose |
|----------|--------|------|---------|
| `/links/create` | POST | storage_write | Create short link |
| `/links/expand/:slug` | GET | free | Expand slug to URL |
| `/links/stats` | POST | storage_read | Get click statistics |
| `/links/list` | GET | storage_read | List all links |
| `/links/delete` | POST | storage_write | Delete a link |

## API Examples

### Create Link
```bash
curl -X POST https://stx402.com/links/create \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <signed-payment>" \
  -d '{"url": "https://example.com/long-path", "slug": "my-link", "title": "Example"}'
```

### Expand Link (free)
```bash
curl https://stx402.com/links/expand/my-link
```

### Get Stats
```bash
curl -X POST https://stx402.com/links/stats \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <signed-payment>" \
  -d '{"slug": "my-link"}'
```

## Features

- **Custom slugs**: Choose your short code or auto-generate
- **Click tracking**: Count, timestamps, referrers, user agents
- **Per-user isolation**: Each payer has own link namespace
- **Durable Objects**: SQLite-backed storage per user

## Pricing

| Endpoint | Tier | Price |
|----------|------|-------|
| `expand` | free | 0 STX |
| `stats`, `list` | storage_read | 0.0005 STX |
| `create`, `delete` | storage_write | 0.001 STX |

## Relationships

- **Uses**: `src/durable-objects/UserDurableObject.ts` for storage

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/links)*
