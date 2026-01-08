---
title: endpoints
layout: default
parent: src
nav_order: 1
has_children: true
---

[← src](../src.md) | **endpoints**

# endpoints

> ~97 API endpoint implementations across 14 categories.

## Contents

| Folder | Count | Purpose |
|--------|-------|---------|
| Root files | ~30 | Individual endpoint classes (Stacks, AI, Utility, etc.) |
| [`hash/`](endpoints/hash.md) | 6 | Cryptographic hashing (SHA, Keccak, Hash160, HMAC) |
| [`agent/`](endpoints/agent.md) | 16 | ERC-8004 agent registry |
| [`counter/`](endpoints/counter.md) | 6 | Atomic counters (Durable Object) |
| [`kv/`](endpoints/kv.md) | 4 | Key-value storage |
| [`links/`](endpoints/links.md) | 5 | URL shortener with click tracking |
| [`memory/`](endpoints/memory.md) | 5 | Agent memory with semantic search |
| [`paste/`](endpoints/paste.md) | 3 | Text paste service |
| [`queue/`](endpoints/queue.md) | 5 | Job queue with priority |
| [`sql/`](endpoints/sql.md) | 3 | Direct SQLite access |
| [`sync/`](endpoints/sync.md) | 5 | Distributed locks |

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
Clarity utilities and aggregated blockchain queries.

| Endpoint | File | Purpose |
|----------|------|---------|
| `convert-address/:address` | `convertAddressToNetwork.ts` | Convert address between networks |
| `decode-clarity-hex` | `decodeClarityHex.ts` | Decode Clarity hex values |
| `to-consensus-buff` | `stacksToConsensusBuff.ts` | Encode to consensus buffer |
| `from-consensus-buff` | `stacksFromConsensusBuff.ts` | Decode from consensus buffer |
| `decode-tx` | `stacksDecodeTx.ts` | Decode transaction hex |
| `profile/:address` | `stacksProfile.ts` | Aggregated BNS + balances + NFTs + block height |
| `contract-info/:contract_id` | `stacksContractInfo.ts` | Contract source + ABI + summary |

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

### Hash (`/api/hash/*`)
Cryptographic hashing (Clarity-compatible).

| Endpoint | File | Purpose |
|----------|------|---------|
| `sha256` | `hash/hashSha256.ts` | SHA-256 hash |
| `sha512` | `hash/hashSha512.ts` | SHA-512 hash |
| `keccak256` | `hash/hashKeccak256.ts` | Keccak-256 (Ethereum) |
| `hash160` | `hash/hashHash160.ts` | RIPEMD160(SHA256(x)) |
| `ripemd160` | `hash/hashRipemd160.ts` | RIPEMD-160 hash |
| `hmac` | `hash/hashHmac.ts` | HMAC signature |

### Data (`/api/data/*`)
JSON utilities (free).

| Endpoint | File | Purpose |
|----------|------|---------|
| `json-validate` | `dataJsonValidate.ts` | Validate JSON syntax (free) |
| `json-minify` | `dataJsonMinify.ts` | Minify JSON (free) |

### Utility (`/api/util/*`)
General utilities.

| Endpoint | File | Purpose |
|----------|------|---------|
| `qr-generate` | `utilQrGenerate.ts` | Generate QR codes |
| `verify-signature` | `utilVerifySignature.ts` | Verify Stacks signatures |

## Relationships

- **All endpoints extend**: `BaseEndpoint` for shared methods
- **Registered in**: `src/index.ts` via chanfana OpenAPI router
- **Pricing defined in**: `src/utils/pricing.ts` (`ENDPOINT_TIERS` map)

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints) · Updated: 2025-01-07*
