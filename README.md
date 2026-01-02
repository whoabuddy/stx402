# STX402

Cloudflare Worker API providing **132 useful endpoints** via [X402 micropayments](https://x402.org). Built with [OpenAPI 3.1](https://github.com/cloudflare/chanfana) + [Hono](https://hono.dev).

## Payment

All paid endpoints require X402 micropayments. Supports `?tokenType=STX|sBTC|USDCx` (case-insensitive).

| Tier | STX | sBTC | USDCx | Use Case |
|------|-----|------|-------|----------|
| Simple | 0.001 | 0.000001 | 0.001 | Utilities, encoding, hashing |
| AI | 0.003 | 0.000003 | 0.003 | Text analysis, summarization |
| Heavy AI | 0.01 | 0.00001 | 0.01 | Image generation, TTS |
| Storage Read | 0.0005 | 0.0000005 | 0.0005 | KV get, list operations |
| Storage Write | 0.001 | 0.000001 | 0.001 | KV set, delete operations |
| Storage Large | 0.005 | 0.000005 | 0.005 | Values > 100KB |

## Endpoints

OpenAPI docs: `GET /` | Dashboard: `GET /dashboard`

### Health (2 free)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/dashboard` | Metrics dashboard |

### Stacks (15 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stacks/get-bns-name/:address` | Primary BNSv2 name lookup |
| `GET` | `/api/stacks/validate-address/:address` | Validate Stacks address |
| `GET` | `/api/stacks/convert-address/:address` | Convert address to mainnet/testnet |
| `POST` | `/api/stacks/decode-clarity-hex` | Decode ClarityValue from hex |
| `GET` | `/api/stacks/contract-source/:contract_id` | Contract source + SHA512/256 hash |
| `GET` | `/api/stacks/contract-abi/:contract_id` | Contract ABI/interface |
| `POST` | `/api/stacks/to-consensus-buff` | Serialize Clarity value |
| `POST` | `/api/stacks/from-consensus-buff` | Deserialize consensus buffer |
| `POST` | `/api/stacks/decode-tx` | Decode raw transaction |
| `POST` | `/api/stacks/call-readonly` | Call read-only contract function |
| `GET` | `/api/stacks/stx-balance/:address` | STX balance lookup |
| `GET` | `/api/stacks/block-height` | Current block height |
| `GET` | `/api/stacks/ft-balance/:address` | Fungible token balances |
| `GET` | `/api/stacks/nft-holdings/:address` | NFT holdings |
| `GET` | `/api/stacks/tx-status/:txid` | Transaction status |

### AI (13 endpoints)

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| `GET` | `/api/ai/dad-joke` | ai | AI-generated dad joke |
| `POST` | `/api/ai/summarize` | ai | Text summarization |
| `POST` | `/api/ai/image-describe` | heavy_ai | Image analysis/description |
| `POST` | `/api/ai/tts` | heavy_ai | Text-to-speech |
| `POST` | `/api/ai/generate-image` | heavy_ai | AI image generation (Flux) |
| `GET` | `/api/ai/explain-contract/:contract_id` | ai | AI contract analysis |
| `POST` | `/api/ai/translate` | ai | Text translation |
| `POST` | `/api/ai/sentiment` | ai | Sentiment analysis |
| `POST` | `/api/ai/keywords` | ai | Keyword extraction |
| `POST` | `/api/ai/language-detect` | ai | Language detection |
| `POST` | `/api/ai/paraphrase` | ai | Text paraphrasing |
| `POST` | `/api/ai/grammar-check` | ai | Grammar checking |
| `POST` | `/api/ai/question-answer` | ai | Question answering |

### Text (24 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/text/base64-encode` | UTF-8 safe base64 encode |
| `POST` | `/api/text/base64-decode` | UTF-8 safe base64 decode |
| `POST` | `/api/text/sha256` | SHA-256 hash |
| `POST` | `/api/text/sha512` | SHA-512 hash |
| `POST` | `/api/text/keccak256` | Keccak-256 hash |
| `POST` | `/api/text/hash160` | RIPEMD160(SHA256(x)) |
| `POST` | `/api/text/url-encode` | URL encode |
| `POST` | `/api/text/url-decode` | URL decode |
| `POST` | `/api/text/jwt-decode` | Decode JWT token |
| `POST` | `/api/text/hmac` | HMAC signature |
| `POST` | `/api/text/html-encode` | HTML entity encode |
| `POST` | `/api/text/html-decode` | HTML entity decode |
| `POST` | `/api/text/hex-encode` | Hex encode |
| `POST` | `/api/text/hex-decode` | Hex decode |
| `POST` | `/api/text/case-convert` | Case conversion |
| `POST` | `/api/text/word-count` | Word/char statistics |
| `POST` | `/api/text/reverse` | Reverse text |
| `POST` | `/api/text/truncate` | Smart truncation |
| `POST` | `/api/text/regex-test` | Regex pattern testing |
| `POST` | `/api/text/rot13` | ROT13 cipher |
| `GET` | `/api/text/lorem-ipsum` | Lorem ipsum generator |
| `GET` | `/api/text/validate-url` | URL validation |
| `POST` | `/api/text/diff` | Text comparison |
| `POST` | `/api/text/unicode-info` | Unicode character info |

### Data (8 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/data/csv-to-json` | CSV to JSON |
| `POST` | `/api/data/json-to-csv` | JSON to CSV |
| `POST` | `/api/data/json-format` | Pretty print JSON |
| `POST` | `/api/data/json-minify` | Minify JSON |
| `POST` | `/api/data/json-validate` | Validate JSON |
| `POST` | `/api/data/json-path` | JSONPath queries |
| `POST` | `/api/data/json-flatten` | Flatten nested JSON |
| `POST` | `/api/data/json-merge` | Deep merge objects |

### Crypto (2 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/crypto/ripemd160` | RIPEMD-160 hash |
| `GET` | `/api/crypto/random-bytes` | Secure random bytes |

### Random (7 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/random/uuid` | UUID v4 |
| `GET` | `/api/random/number` | Random number |
| `GET` | `/api/random/string` | Random string |
| `GET` | `/api/random/password` | Secure password |
| `GET` | `/api/random/color` | Random color |
| `GET` | `/api/random/dice` | Dice roll |
| `POST` | `/api/random/shuffle` | Array shuffle |

### Math (6 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/math/calculate` | Expression calculator |
| `POST` | `/api/math/percentage` | Percentage operations |
| `POST` | `/api/math/statistics` | Statistical analysis |
| `GET` | `/api/math/prime-check` | Prime number check |
| `POST` | `/api/math/gcd-lcm` | GCD/LCM calculation |
| `GET` | `/api/math/factorial` | Factorial |

### Utility (23 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/util/timestamp` | Current timestamp |
| `GET` | `/api/util/dns-lookup` | DNS lookup |
| `GET` | `/api/util/ip-info` | IP geolocation |
| `POST` | `/api/util/qr-generate` | QR code generation |
| `GET` | `/api/util/timestamp-convert` | Timestamp conversion |
| `GET` | `/api/util/date-diff` | Date difference |
| `POST` | `/api/util/date-add` | Date arithmetic |
| `GET` | `/api/util/cron-parse` | Cron expression parser |
| `GET` | `/api/util/user-agent-parse` | User agent parser |
| `GET` | `/api/util/url-parse` | URL parser |
| `GET` | `/api/util/color-convert` | Color format conversion |
| `POST` | `/api/util/markdown-to-html` | Markdown to HTML |
| `GET` | `/api/util/http-status` | HTTP status lookup |
| `GET` | `/api/util/validate-email` | Email validation |
| `POST` | `/api/util/url-build` | URL builder |
| `POST` | `/api/util/html-to-text` | HTML to plain text |
| `GET` | `/api/util/base64-image` | Placeholder image |
| `GET` | `/api/util/bytes-format` | Bytes formatter |
| `POST` | `/api/util/slugify` | Advanced slugify |
| `GET` | `/api/util/mime-type` | MIME type lookup |
| `POST` | `/api/util/regex-escape` | Regex escape |
| `POST` | `/api/util/string-distance` | String similarity |
| `POST` | `/api/util/verify-signature` | Stacks signature verification |

### Network (6 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/net/geo-ip` | IP geolocation |
| `GET` | `/api/net/asn-lookup` | ASN lookup |
| `GET` | `/api/net/request-fingerprint` | Request fingerprinting |
| `POST` | `/api/net/http-probe` | HTTP endpoint probing |
| `POST` | `/api/net/cors-proxy` | CORS proxy |
| `POST` | `/api/net/ssl-check` | SSL certificate check |

### Registry (10 endpoints)

API endpoint discovery and registration system.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| `POST` | `/api/registry/probe` | ai | Probe endpoint reachability |
| `POST` | `/api/registry/register` | ai | Register a new endpoint |
| `GET` | `/api/registry/list` | free | List all registered endpoints |
| `POST` | `/api/registry/details` | ai | Get endpoint details |
| `POST` | `/api/registry/update` | ai | Update endpoint metadata |
| `POST` | `/api/registry/delete` | ai | Delete an endpoint |
| `POST` | `/api/registry/my-endpoints` | ai | List your registered endpoints |
| `POST` | `/api/registry/transfer` | ai | Transfer ownership |
| `POST` | `/api/admin/registry/verify` | ai | Admin: verify endpoint |
| `POST` | `/api/admin/registry/pending` | ai | Admin: list pending endpoints |

**Features:**
- Endpoint discovery across the API marketplace
- Owner-verified endpoints
- Category-based organization
- Transfer ownership capability

### KV Storage (4 endpoints)

Stateful key-value storage with TTL support. Keys are namespaced by payer address for automatic isolation.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| `POST` | `/api/kv/set` | storage_write | Store value with optional TTL |
| `POST` | `/api/kv/get` | storage_read | Retrieve value by key |
| `POST` | `/api/kv/delete` | storage_write | Delete value by key |
| `POST` | `/api/kv/list` | storage_read | List keys by prefix |

**Features:**
- Automatic namespace isolation by payer address
- Public/private visibility options
- TTL support (60s minimum, default 24h)
- Value size up to 25MB (large tier pricing for > 100KB)
- Prefix-based listing with pagination

### Paste (3 endpoints)

Simple paste service with short codes for sharing text snippets.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| `POST` | `/api/paste/create` | storage_write | Create paste, get short code |
| `GET` | `/api/paste/:code` | storage_read | Retrieve paste by code |
| `POST` | `/api/paste/delete` | storage_write | Delete paste (owner only) |

**Features:**
- 6-character alphanumeric short codes
- Language hint for syntax highlighting
- TTL: 60s min, 7 days default, 30 days max
- Max content size: 500KB
- Owner-only deletion

### Counter (6 endpoints)

Atomic counters backed by Durable Objects with SQLite storage. Each payer gets isolated counter namespace.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| `POST` | `/api/counter/increment` | storage_write | Atomically increment counter |
| `POST` | `/api/counter/decrement` | storage_write | Atomically decrement counter |
| `GET` | `/api/counter/get` | storage_read | Get counter value and metadata |
| `POST` | `/api/counter/reset` | storage_write | Reset counter to zero or value |
| `GET` | `/api/counter/list` | storage_read | List all counters |
| `POST` | `/api/counter/delete` | storage_write | Delete a counter |

**Features:**
- Atomic increment/decrement with configurable step
- Optional min/max bounds (capped counters)
- Persistent storage via Cloudflare Durable Objects
- Per-user isolation (by payer address)

### SQL (3 endpoints)

Direct SQL access to your per-user SQLite database in Durable Objects.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| `POST` | `/api/sql/query` | storage_read | Execute SELECT query |
| `POST` | `/api/sql/execute` | storage_write | Execute write query (CREATE, INSERT, UPDATE, DELETE) |
| `GET` | `/api/sql/schema` | storage_read | Get database schema |

**Features:**
- Full SQLite syntax support
- Parameterized queries for safety
- System tables protected (counters, user_data)
- Create your own tables for custom data
- Per-user isolation (by payer address)

## Project Structure

```
src/
├── endpoints/          # OpenAPIRoute classes (one per endpoint)
│   ├── BaseEndpoint.ts # Shared methods (getTokenType, getPayerAddress, etc.)
│   ├── stacks*.ts      # Stacks/Clarity endpoints
│   ├── ai*.ts          # AI-powered endpoints
│   ├── crypto*.ts      # Cryptographic endpoints
│   ├── data*.ts        # Data transformation
│   ├── math*.ts        # Math operations
│   ├── random*.ts      # Random generation
│   ├── text*.ts        # Text/encoding utilities
│   ├── util*.ts        # General utilities
│   ├── kv/             # KV storage endpoints
│   │   └── kv*.ts      # set, get, delete, list
│   ├── paste/          # Paste endpoints
│   │   └── paste*.ts   # create, get, delete
│   ├── counter/        # Counter endpoints (Durable Objects)
│   │   └── counter*.ts # increment, decrement, get, reset, list, delete
│   └── sql/            # SQL endpoints (Durable Objects)
│       └── sql*.ts     # query, execute, schema
├── durable-objects/
│   └── UserDurableObject.ts  # Per-user SQLite-backed DO
├── middleware/
│   ├── x402-stacks.ts  # X402 payment verification
│   └── metrics.ts      # Usage tracking (KV)
├── utils/
│   ├── namespace.ts    # KV key formatting utilities
│   └── pricing.ts      # Pricing tiers and amounts
└── index.ts            # Hono app + route registration
```

## Development

```bash
npm install
npm run dev          # Local dev server with hot reload
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Regenerate types from wrangler bindings
```

## Tests

E2E tests require testnet mnemonic for X402 payment signing:

```bash
# Setup
cp .env.example .env
# Edit .env: X402_CLIENT_PK="your testnet mnemonic"

# Run
npm run dev                              # Terminal 1
bun run tests/_run_all_tests.ts          # Terminal 2
```

## Dependencies

| Package | Purpose |
|---------|---------|
| [hono](https://hono.dev) | HTTP routing |
| [chanfana](https://github.com/cloudflare/chanfana) | OpenAPI 3.1 |
| [@stacks/transactions](https://docs.stacks.co/stacks.js) | Stacks utilities |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) | Cryptographic hashing |
| [x402-stacks](https://x402.org) | X402 payments |

## License

MIT
