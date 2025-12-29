# STX402

Cloudflare Worker API providing **100 useful endpoints** via [X402 micropayments](https://x402.org). Built with [OpenAPI 3.1](https://github.com/cloudflare/chanfana) + [Hono](https://hono.dev).

**Current: 26 endpoints | Target: 100 endpoints**

## Payment

All paid endpoints require X402 micropayments. Supports `?tokenType=STX|sBTC|USDCx` (case-insensitive).

| Tier | STX | sBTC | USDCx | Use Case |
|------|-----|------|-------|----------|
| Simple | 0.001 | 0.000001 | 0.001 | Utilities, encoding, hashing |
| AI | 0.003 | 0.000003 | 0.003 | Text analysis, summarization |
| Heavy AI | 0.01 | 0.00001 | 0.01 | Image generation, TTS |

## Endpoints

OpenAPI docs: `GET /` | Dashboard: `GET /dashboard`

### Health (Free)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/dashboard` | Metrics dashboard |

### Stacks (8 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stacks/get-bns-name/:address` | Primary BNSv2 name lookup |
| `GET` | `/api/stacks/validate-address/:address` | Validate Stacks address |
| `GET` | `/api/stacks/convert-address/:address` | Convert address to mainnet/testnet |
| `POST` | `/api/stacks/decode-clarity-hex` | Decode ClarityValue from hex |
| `GET` | `/api/stacks/contract-source/:contract_id` | Contract source + SHA512/256 hash |
| `GET` | `/api/stacks/contract-abi/:contract_id` | Contract ABI/interface |
| `POST` | `/api/stacks/to-consensus-buff` | Serialize Clarity value (matches `to-consensus-buff?`) |
| `POST` | `/api/stacks/from-consensus-buff` | Deserialize buffer (matches `from-consensus-buff?`) |

### AI (6 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ai/dad-joke` | AI-generated dad joke |
| `POST` | `/api/ai/summarize` | Text summarization |
| `POST` | `/api/ai/image-describe` | Image analysis/description |
| `POST` | `/api/ai/tts` | Text-to-speech |
| `POST` | `/api/ai/generate-image` | AI image generation (Flux) |
| `GET` | `/api/ai/explain-contract/:contract_id` | AI contract analysis |

### Random (3 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/random/uuid` | Cryptographically secure UUID v4 |
| `GET` | `/api/random/number` | Secure random number (min/max/count) |
| `GET` | `/api/random/string` | Secure random string (charset options) |

### Text (6 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/text/base64-encode` | UTF-8 safe base64 encode (urlSafe option) |
| `POST` | `/api/text/base64-decode` | UTF-8 safe base64 decode |
| `POST` | `/api/text/sha256` | SHA-256 hash (SubtleCrypto) |
| `POST` | `/api/text/sha512` | SHA-512 hash (SubtleCrypto) |
| `POST` | `/api/text/keccak256` | Keccak-256 hash (Ethereum/Clarity) |
| `POST` | `/api/text/hash160` | RIPEMD160(SHA256(x)) (Bitcoin/Clarity) |

### Utility (1 endpoint)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/util/timestamp` | Current timestamp (unix, iso, utc) |

## Roadmap to 100 Endpoints

### Planned Categories

| Category | Planned | Examples |
|----------|---------|----------|
| Text | +15 | url-encode, jwt-decode, regex-test, markdown-to-html |
| Data | +10 | json-format, csv-to-json, xml-to-json, yaml-to-json |
| Random | +5 | password, color, dice, shuffle |
| Utility | +15 | dns-lookup, ip-info, qr-generate, cron-parse |
| Math | +10 | calculate, unit-convert, statistics, prime-check |
| Crypto | +10 | btc-validate, stx-balance, verify-message |
| AI | +10 | sentiment, translate, code-explain, image-ocr |

### Design Principles

1. **Simple over complex** - Each endpoint does one thing well
2. **Composable outputs** - Results can chain into other endpoints
3. **Zero external deps where possible** - Use SubtleCrypto, @noble/hashes
4. **Cacheable when immutable** - Contract source/ABI cached indefinitely
5. **Usage-driven surfacing** - Best endpoints rise to top via metrics

## Project Structure

```
src/
├── endpoints/          # OpenAPIRoute classes (one per endpoint)
│   ├── BaseEndpoint.ts # Shared methods
│   ├── stacks*.ts      # Stacks/Clarity endpoints
│   ├── ai*.ts          # AI-powered endpoints
│   ├── random*.ts      # Random generation
│   ├── text*.ts        # Text/encoding utilities
│   └── util*.ts        # General utilities
├── middleware/
│   ├── x402-stacks.ts  # X402 payment verification
│   └── metrics.ts      # Usage tracking (KV)
├── utils/              # Shared utilities
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
