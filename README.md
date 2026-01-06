# STX402

API marketplace with **168 useful endpoints** via [X402 micropayments](https://x402.org). Pay-per-use with STX, sBTC, or USDCx.

## Documentation

| Page | Description |
|------|-------------|
| [API Docs](https://stx402.com) | Interactive OpenAPI documentation |
| [Guide](https://stx402.com/guide) | Endpoint categories and use cases |
| [About](https://stx402.com/about) | How X402 payments work |
| [Dashboard](https://stx402.com/dashboard) | Live metrics and registry |

## Pricing

All paid endpoints accept `?tokenType=STX|sBTC|USDCx` (case-insensitive).

| Tier | STX | sBTC | USDCx | Use Case |
|------|-----|------|-------|----------|
| Simple | 0.001 | 0.000001 | 0.001 | Utilities, encoding, hashing |
| AI | 0.003 | 0.000003 | 0.003 | Text analysis, summarization |
| Heavy AI | 0.01 | 0.00001 | 0.01 | Image generation, TTS |
| Storage Read | 0.0005 | 0.0000005 | 0.0005 | KV get, list operations |
| Storage Write | 0.001 | 0.000001 | 0.001 | KV set, delete operations |
| Storage Large | 0.005 | 0.000005 | 0.005 | Values > 100KB |
| Storage AI | 0.003 | 0.000003 | 0.003 | Memory with embeddings |

## Development

```bash
npm install
npm run dev          # Local dev server
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Regenerate types from wrangler bindings
```

## Tests

E2E tests require testnet mnemonic for X402 payment signing:

```bash
cp .env.example .env
# Edit .env: X402_CLIENT_PK="your testnet mnemonic"

npm run dev                              # Terminal 1
bun run tests/_run_all_tests.ts          # Terminal 2
```

## License

MIT
