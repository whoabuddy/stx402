# STX402 Directory

The meta layer for the X402 ecosystem - endpoint discovery and ERC-8004 agent identity on Stacks.

**[API Docs](https://stx402.com/docs)** · **[Guide](https://stx402.com/guide)** · **[About](https://stx402.com/about)** · **[Dashboard](https://stx402.com/dashboard)**

## What is STX402?

- **Registry**: Discover and register X402-compatible endpoints
- **Agent**: ERC-8004 agent identity, reputation, and validation
- **Links**: URL shortener with click tracking

For general utilities, storage, and inference: [x402.aibtc.com](https://x402.aibtc.com)

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
