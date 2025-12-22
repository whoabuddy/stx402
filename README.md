# STX402

Cloudflare Worker API for Stacks/BNS queries with [OpenAPI 3.1](https://github.com/cloudflare/chanfana) + [Hono](https://hono.dev).

## Endpoints

OpenAPI docs: `GET /`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/get-bns-name/:address` | Primary BNSv2 name for Stacks address |
| `GET` | `/api/validate-stacks-address/:address` | Validate Stacks address |

## Project Structure

```
.
├── src/
│   ├── endpoints/     # OpenAPIRoute classes (e.g. getBnsName.ts)
│   ├── utils/         # Helpers (e.g. bns.ts)
│   ├── types.ts       # Shared types/Zod schemas
│   └── index.ts       # Hono app + chanfana setup
├── wrangler.jsonc     # Config
├── package.json       # Deps: chanfana, hono, @stacks/*
└── worker-configuration.d.ts  # Cloudflare types (read-only)
```

## Adding Endpoints

**1. Create `src/endpoints/NewEndpoint.ts`** (Hono + chanfana format):

```typescript
import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";

export class NewEndpoint extends OpenAPIRoute {
  schema = {
    summary: "New endpoint",
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { result: { type: "string" } } } } } }
  };

  async handle(c: AppContext) {
    const id = c.req.param("id");
    return c.json({ result: `Hello ${id}` });
  }
}
```

**2. Register in `src/index.ts`**:

```typescript
import { NewEndpoint } from "./endpoints/NewEndpoint";

openapi.get("/api/new/:id", NewEndpoint);
```

**3. Run `wrangler types` + `wrangler dev` to test.**

## Development

```bash
npm i
wrangler dev        # Local (with hot reload)
wrangler deploy     # Production
wrangler types      # Update Env types from bindings
```

## Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| [chanfana](https://github.com/cloudflare/chanfana) | OpenAPI 3.1 | ^2.6.3 |
| [hono](https://hono.dev) | Fast routing | ^4.6.20 |
| [@stacks/transactions](https://github.com/hirosystems/stacks.js) | Stacks/BNS utils | ^7.3.1 |

Built with [Wrangler 4](https://developers.cloudflare.com/workers/wrangler/) (`npm i -D wrangler@^4.56.0`).
