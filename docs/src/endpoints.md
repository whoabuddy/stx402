---
title: endpoints
layout: default
parent: src
nav_order: 1
has_children: true
---

[← src](../src.md) | **endpoints**

# endpoints

> 173 API endpoint implementations across 20 categories.

## Contents

| Folder | Count | Purpose |
|--------|-------|---------|
| Root files | ~125 | Individual endpoint classes (Stacks, AI, Text, etc.) |
| [`agent/`](endpoints/agent.md) | 17 | ERC-8004 agent registry |
| [`counter/`](endpoints/counter.md) | 7 | Atomic counters (Durable Object) |
| [`kv/`](endpoints/kv.md) | 5 | Key-value storage |
| [`links/`](endpoints/links.md) | 6 | URL shortener with click tracking |
| [`memory/`](endpoints/memory.md) | 6 | Agent memory with semantic search |
| [`paste/`](endpoints/paste.md) | 4 | Text paste service |
| [`queue/`](endpoints/queue.md) | 6 | Job queue with priority |
| [`sql/`](endpoints/sql.md) | 4 | Direct SQLite access |
| [`sync/`](endpoints/sync.md) | 6 | Distributed locks |

## Endpoint Pattern

All endpoints extend `BaseEndpoint`:

```typescript
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MyEndpoint extends BaseEndpoint {
  schema = {
    tags: ["Category"],
    summary: "(paid) Description",
    parameters: [...],
    responses: { "200": {...}, "402": {...} },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    // ... logic
    return c.json({ result, tokenType });
  }
}
```

## Categories by Path

### Stacks (`/api/stacks/*`)
Blockchain queries, BNS resolution, Clarity utilities, contract analysis.

| Endpoint | File | Purpose |
|----------|------|---------|
| `bns-name/:address` | `getBnsName.ts` | Resolve BNS name for address |
| `validate-address/:address` | `validateStacksAddress.ts` | Validate Stacks address format |
| `convert-address/:address` | `convertAddressToNetwork.ts` | Convert address between networks |
| `decode-clarity-hex` | `decodeClarityHex.ts` | Decode Clarity hex values |
| `contract-source/:principal` | `stacksContractSource.ts` | Get contract source code |
| `contract-abi/:principal` | `stacksContractAbi.ts` | Get contract ABI |
| `to-consensus-buff` | `stacksToConsensusBuff.ts` | Encode to consensus buffer |
| `from-consensus-buff` | `stacksFromConsensusBuff.ts` | Decode from consensus buffer |
| `decode-tx` | `stacksDecodeTx.ts` | Decode transaction hex |
| `call-readonly` | `stacksCallReadonly.ts` | Call read-only function |
| `stx-balance/:address` | `stacksStxBalance.ts` | Get STX balance |
| `block-height` | `stacksBlockHeight.ts` | Get current block height |
| `ft-balance` | `stacksFtBalance.ts` | Get fungible token balance |
| `nft-holdings` | `stacksNftHoldings.ts` | Get NFT holdings |
| `tx-status/:txid` | `stacksTxStatus.ts` | Get transaction status |

### AI (`/api/ai/*`)
Text analysis, translation, image generation.

| Endpoint | File | Purpose |
|----------|------|---------|
| `summarize` | `summarize.ts` | Text summarization |
| `translate` | `aiTranslate.ts` | Text translation |
| `sentiment` | `aiSentiment.ts` | Sentiment analysis |
| `keywords` | `aiKeywords.ts` | Keyword extraction |
| `language-detect` | `aiLanguageDetect.ts` | Language detection |
| `paraphrase` | `aiParaphrase.ts` | Text paraphrasing |
| `grammar-check` | `aiGrammarCheck.ts` | Grammar correction |
| `question-answer` | `aiQuestionAnswer.ts` | Q&A from context |
| `explain-contract` | `aiExplainContract.ts` | Clarity contract analysis |
| `dad-joke` | `dadJoke.ts` | Generate dad jokes |
| `describe-image` | `imageDescribe.ts` | Image description |
| `tts` | `tts.ts` | Text-to-speech |
| `generate-image` | `generateImage.ts` | AI image generation |

### Text (`/api/text/*`)
Encoding, hashing, compression, manipulation.

- `base64-encode/decode`, `url-encode/decode`, `html-encode/decode`, `hex-encode/decode`
- `sha256`, `sha512`, `keccak256`, `hash160`, `hmac`
- `compress/decompress` (gzip)
- `case-convert`, `word-count`, `reverse`, `truncate`, `regex-test`
- `rot13`, `lorem-ipsum`, `validate-url`, `diff`, `unicode-info`

### Data (`/api/data/*`)
JSON/CSV processing and transformation.

- `csv-to-json`, `json-to-csv`, `json-format`, `json-flatten`, `json-merge`
- `json-validate`, `json-query`, `json-diff`

### Random (`/api/random/*`)
Secure random generation.

- `uuid`, `number`, `string`, `password`, `color`, `dice`, `shuffle`

### Math (`/api/math/*`)
Calculations and statistics.

- `calculate`, `percentage`, `statistics`, `prime-check`, `gcd-lcm`, `factorial`

### Utility (`/api/util/*`)
General utilities.

- Timestamps, DNS lookup, QR codes, URL parsing, Markdown rendering, etc.

### Network (`/api/net/*`)
Network utilities.

- Geo-IP, ASN lookup, SSL certificate check, ping, WHOIS

### Crypto (`/api/crypto/*`)
Cryptographic operations.

- `ripemd160`, `random-bytes`

## Relationships

- **All endpoints extend**: `BaseEndpoint` for shared methods
- **Registered in**: `src/index.ts` via chanfana OpenAPI router
- **Pricing defined in**: `src/utils/pricing.ts` (`ENDPOINT_TIERS` map)

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints) · Updated: 2025-01-07*
