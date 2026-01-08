# STX402

API marketplace with **92 paid endpoints** via [X402 micropayments](https://x402.org). Pay-per-use with STX, sBTC, or USDCx.

**[API Docs](https://stx402.com)** · **[Guide](https://stx402.com/guide)** · **[About](https://stx402.com/about)** · **[Dashboard](https://stx402.com/dashboard)**

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
