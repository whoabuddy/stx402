# Endpoint Consolidation Analysis

Comparing **stx402.com** vs **x402.aibtc.com** to determine what stays, migrates, or becomes the unique value proposition.

## Endpoint Comparison Table

| Category | Endpoint | stx402.com | x402.aibtc.com | Notes |
|----------|----------|:----------:|:--------------:|-------|
| **STACKS** | | | | |
| | convert-address | ✓ | ✓ | Duplicate - migrate |
| | decode-clarity-hex | ✓ | ✓ | Duplicate - migrate |
| | to-consensus-buff | ✓ | ✗ | **UNIQUE** |
| | from-consensus-buff | ✓ | ✗ | **UNIQUE** |
| | decode-tx | ✓ | ✓ | Duplicate - migrate |
| | profile | ✓ | ✓ | Duplicate - migrate |
| | contract-info | ✓ | ✗ | **UNIQUE** (aggregated endpoint) |
| | verify-message | ✗ | ✓ | Only on aibtc |
| | verify-sip018 | ✗ | ✓ | Only on aibtc |
| **HASHING** | | | | |
| | sha256 | ✓ | ✓ | Duplicate - migrate |
| | sha512 | ✓ | ✓ | Duplicate - migrate |
| | sha512-256 | ✗ | ✓ | Only on aibtc |
| | keccak256 | ✓ | ✓ | Duplicate - migrate |
| | hash160 | ✓ | ✓ | Duplicate - migrate |
| | ripemd160 | ✓ | ✓ | Duplicate - migrate |
| | hmac | ✓ | ✗ | **UNIQUE** |
| **AI / INFERENCE** | | | | |
| | openrouter/models | ✗ | ✓ | Only on aibtc (free list) |
| | openrouter/chat | ✗ | ✓ | Only on aibtc (dynamic pricing) |
| | cloudflare/models | ✗ | ✓ | Only on aibtc (free list) |
| | cloudflare/chat | ✗ | ✓ | Only on aibtc |
| | dad-joke | ✓ | ✗ | **UNIQUE** (fun/demo) |
| | summarize | ✓ | ✗ | **UNIQUE** |
| | image-describe | ✓ | ✗ | **UNIQUE** |
| | tts | ✓ | ✗ | **UNIQUE** |
| | generate-image | ✓ | ✗ | **UNIQUE** |
| | explain-contract | ✓ | ✗ | **UNIQUE** |
| | translate | ✓ | ✗ | **UNIQUE** |
| | sentiment | ✓ | ✗ | **UNIQUE** |
| | keywords | ✓ | ✗ | **UNIQUE** |
| | language-detect | ✓ | ✗ | **UNIQUE** |
| | paraphrase | ✓ | ✗ | **UNIQUE** |
| | grammar-check | ✓ | ✗ | **UNIQUE** |
| | question-answer | ✓ | ✗ | **UNIQUE** |
| **DATA** | | | | |
| | json-minify | ✓ (free) | ✗ | **UNIQUE** |
| | json-validate | ✓ (free) | ✗ | **UNIQUE** |
| **UTILITY** | | | | |
| | qr-generate | ✓ | ✗ | **UNIQUE** |
| | verify-signature | ✓ | ✗ | **UNIQUE** (could merge with aibtc verify-*) |
| **STORAGE - KV** | | | | |
| | set/get/delete/list | ✓ | ✓ | Duplicate - migrate |
| **STORAGE - PASTE** | | | | |
| | create/get/delete | ✓ | ✓ | Duplicate - migrate |
| **STORAGE - DB** | | | | |
| | query | ✓ | ✓ | Duplicate - migrate |
| | execute | ✓ | ✓ | Duplicate - migrate |
| | schema | ✓ | ✓ | Duplicate - migrate |
| **STORAGE - SYNC** | | | | |
| | lock/unlock/etc | ✓ | ✓ | Duplicate - migrate |
| **STORAGE - QUEUE** | | | | |
| | push/pop/status/etc | ✓ | ✓ | Duplicate - migrate |
| | complete/fail | ✓ | ✗ | **UNIQUE** (extended API) |
| | peek/clear | ✗ | ✓ | Only on aibtc |
| **STORAGE - MEMORY** | | | | |
| | store/search/etc | ✓ | ✓ | Duplicate - migrate |
| | recall | ✓ | ✗ | **UNIQUE** (by exact key) |
| | forget | ✓ | ✗ | **UNIQUE** (renamed delete) |
| | clear | ✗ | ✓ | Only on aibtc |
| **COUNTER** | | | | |
| | increment/decrement/etc | ✓ | ✗ | **UNIQUE** |
| **LINKS** | | | | |
| | create/expand/stats/etc | ✓ | ✗ | **UNIQUE** |
| **REGISTRY** | | | | |
| | probe | ✓ | ✗ | **UNIQUE** |
| | register | ✓ | ✗ | **UNIQUE** |
| | list | ✓ (free) | ✗ | **UNIQUE** |
| | details | ✓ | ✗ | **UNIQUE** |
| | update | ✓ | ✗ | **UNIQUE** |
| | delete | ✓ | ✗ | **UNIQUE** |
| | my-endpoints | ✓ | ✗ | **UNIQUE** |
| | transfer | ✓ | ✗ | **UNIQUE** |
| | admin-verify | ✓ (free) | ✗ | **UNIQUE** |
| | admin-pending | ✓ (free) | ✗ | **UNIQUE** |
| **AGENT (ERC-8004)** | | | | |
| | registry (meta) | ✓ (free) | ✗ | **UNIQUE** |
| | info | ✓ | ✗ | **UNIQUE** |
| | owner | ✓ | ✗ | **UNIQUE** |
| | uri | ✓ | ✗ | **UNIQUE** |
| | metadata | ✓ | ✗ | **UNIQUE** |
| | version | ✓ | ✗ | **UNIQUE** |
| | lookup | ✓ | ✗ | **UNIQUE** |
| | reputation/* (5) | ✓ | ✗ | **UNIQUE** |
| | validation/* (4) | ✓ | ✗ | **UNIQUE** |

## Summary Statistics

### stx402.com Endpoints (Current: ~97 routes)

| Status | Count | Percentage |
|--------|-------|------------|
| **UNIQUE** | 57 | 59% |
| Duplicate (migrate away) | 40 | 41% |

### Unique Value Categories

1. **Registry System** (10 endpoints) - The "paid directory" for x402 endpoints
2. **ERC-8004 Agent Registry** (16 endpoints) - Agent identity, reputation, validation
3. **Cloudflare AI Wrappers** (13 endpoints) - Specialized AI tasks (TTS, image gen, etc.)
4. **Links** (5 endpoints) - URL shortener with analytics
5. **Counters** (6 endpoints) - Atomic counters (Durable Objects)
6. **Clarity-specific** (2 endpoints) - consensus-buff encoding/decoding
7. **Utility** (3 endpoints) - QR codes, HMAC, signature verification

## Recommended Strategy

### Phase 1: Focus stx402.com on Unique Value

**Keep and Improve:**

1. **Registry System** - The "paid directory" concept is unique
   - Endpoint discovery for x402
   - Verification workflow
   - Usage tracking integration

2. **ERC-8004 Agent Registry** - Strategic for AI agent ecosystem
   - Agent identity on Stacks
   - Reputation system
   - Validation tracking

3. **Specialty Endpoints:**
   - `to-consensus-buff` / `from-consensus-buff` (Clarity dev tools)
   - `contract-info` (aggregated Stacks data)
   - Links/Counters (useful for agents)
   - QR generation (utility)

### Phase 2: Remove Duplicates

These are now available on x402.aibtc.com and should be removed:
- Basic Stacks utilities (convert-address, decode-clarity, decode-tx, profile)
- Basic hashing (SHA256, SHA512, Keccak256, Hash160, RIPEMD160)
- Storage primitives (KV, Paste, DB, Sync, Queue, Memory base operations)

### Phase 3: Strategic Positioning

**stx402.com becomes:**
- The **directory layer** for x402 endpoints
- The **ERC-8004 interface** for Stacks agents
- Home for **specialty tools** not worth hosting on the main API

**x402.aibtc.com becomes:**
- The **workhorse API** for common operations
- LLM inference hub (OpenRouter + Cloudflare)
- Storage primitives

## Migration Path

```
Current (stx402.com):                    Future (stx402.com):
├── api/stacks/* (7)      ─┐            ├── api/registry/* (10)    KEEP
├── api/ai/* (13)          │            ├── api/agent/* (16)       KEEP
├── api/hash/* (6)         │            ├── api/stacks/
├── api/util/* (2)         │            │   ├── to-consensus-buff  KEEP
├── api/data/* (2)         ├─ MIGRATE   │   ├── from-consensus-buff KEEP
├── api/kv/* (4)           │   TO       │   └── contract-info      KEEP
├── api/paste/* (3)        │  aibtc     ├── api/util/
├── api/sql/* (3)          │            │   └── qr-generate        KEEP
├── api/sync/* (5)         │            ├── api/links/* (5)        KEEP
├── api/queue/* (5)        │            └── api/counter/* (6)      KEEP
├── api/memory/* (5)      ─┘
├── api/registry/* (10)                 Total: ~42 endpoints (from 97)
├── api/agent/* (16)
├── api/links/* (5)
└── api/counter/* (6)
```

## Questions to Resolve

1. **AI Endpoints**: Move specialized AI (TTS, image gen, summarize, etc.) to aibtc or keep as showcase?
   - Pros of keeping: Good demos, interesting use cases
   - Cons: Cloudflare AI is already on aibtc

2. **Signature Verification**: stx402 has `verify-signature`, aibtc has `verify-message` + `verify-sip018`
   - Consider consolidating all verification to aibtc

3. **Data Endpoints**: JSON minify/validate are free and simple
   - Keep as "free tier" showcase or remove entirely?

4. **HMAC**: Only on stx402 - worth keeping for Clarity hash compatibility?
