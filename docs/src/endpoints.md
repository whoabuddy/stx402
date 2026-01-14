---
title: endpoints
layout: default
parent: src
nav_order: 1
has_children: true
---

[← src](../src.md) | **endpoints**

# endpoints

> 35 API endpoint implementations across 4 categories.

## Contents

| Folder | Count | Purpose |
|--------|-------|---------|
| Root files | 14 | Info pages, registry endpoints |
| [`agent/`](endpoints/agent.md) | 16 | ERC-8004 agent registry |
| [`links/`](endpoints/links.md) | 5 | URL shortener with click tracking |

## Endpoint Pattern

All endpoints extend chanfana's `OpenAPIRoute`:

```typescript
import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";

export class MyEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Category"],
    summary: "(paid) Description",
    parameters: [...],
    responses: { "200": {...}, "402": {...} },
  };

  async handle(c: AppContext) {
    // ... logic
    return c.json({ result });
  }
}
```

## Categories by Path

### Info (free)

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /` | `index.ts` | JSON service info |
| `GET /health` | `health.ts` | Health check |
| `GET /dashboard` | `dashboard.ts` | Metrics dashboard |
| `GET /guide` | `guide.ts` | Endpoint category guide |
| `GET /toolbox` | `toolbox.ts` | 402 checker tool |
| `GET /docs` | chanfana | Swagger UI |
| `GET /openapi.json` | chanfana | OpenAPI spec |

### Registry (`/registry/*`)

X402 endpoint discovery and registration.

| Endpoint | Method | Tier | Purpose |
|----------|--------|------|---------|
| `/registry/list` | GET | free | List all registered endpoints |
| `/registry/probe` | POST | ai | Check URL for X402 support |
| `/registry/register` | POST | ai | Register a new endpoint |
| `/registry/details` | POST | ai | Get endpoint details |
| `/registry/update` | POST | ai | Update endpoint metadata |
| `/registry/delete` | POST | ai | Delete your endpoint |
| `/registry/my-endpoints` | POST | ai | List your endpoints |
| `/registry/transfer` | POST | ai | Transfer ownership |
| `/admin/registry/pending` | POST | free | List pending (admin only) |
| `/admin/registry/verify` | POST | free | Verify/reject (admin only) |

### Links (`/links/*`)

URL shortener with click tracking.

| Endpoint | Method | Tier | Purpose |
|----------|--------|------|---------|
| `/links/create` | POST | storage_write | Create short link |
| `/links/expand/:slug` | GET | free | Expand slug to URL |
| `/links/stats` | POST | storage_read | Get click statistics |
| `/links/list` | GET | storage_read | List your links |
| `/links/delete` | POST | storage_write | Delete a link |

### Agent (`/agent/*`)

ERC-8004 agent identity, reputation, and validation on Stacks.

| Endpoint | Method | Tier | Purpose |
|----------|--------|------|---------|
| `/agent/registry` | GET | free | Contract addresses |
| `/agent/info` | POST | simple | Agent info by ID |
| `/agent/owner` | GET | simple | Get agent owner |
| `/agent/uri` | GET | simple | Get agent URI |
| `/agent/metadata` | POST | simple | Get agent metadata |
| `/agent/version` | GET | simple | Registry version |
| `/agent/lookup` | POST | simple | Find agents by owner |
| `/agent/reputation/summary` | POST | simple | Reputation summary |
| `/agent/reputation/feedback` | POST | simple | Get specific feedback |
| `/agent/reputation/list` | POST | simple | List all feedback |
| `/agent/reputation/clients` | POST | simple | List clients |
| `/agent/reputation/auth-hash` | POST | simple | Generate auth hash |
| `/agent/validation/status` | POST | simple | Validation status |
| `/agent/validation/summary` | POST | simple | Validation summary |
| `/agent/validation/list` | POST | simple | List validations |
| `/agent/validation/requests` | POST | simple | List requests |

## Relationships

- **All endpoints extend**: `OpenAPIRoute` from chanfana
- **Registered in**: `src/index.ts` via chanfana OpenAPI router
- **Pricing defined in**: `src/utils/pricing.ts` (`ENDPOINT_TIERS` map)

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints)*
