---
title: agent
layout: default
parent: endpoints
grand_parent: src
nav_order: 1
---

[← endpoints](../endpoints.md) | **agent**

# agent

> ERC-8004 agent registry endpoints for identity, reputation, and validation on Stacks.

## Contents

| File | Purpose |
|------|---------|
| `registryInfo.ts` | Contract addresses and specification |
| `agentInfo.ts` | Get agent info by ID |
| `agentOwner.ts` | Get agent owner address |
| `agentUri.ts` | Get agent URI |
| `agentMetadata.ts` | Get agent metadata by key |
| `agentVersion.ts` | Get registry version |
| `agentLookup.ts` | Find agents by owner |
| `reputationSummary.ts` | Get reputation summary |
| `reputationFeedback.ts` | Get specific feedback |
| `reputationList.ts` | List all feedback |
| `reputationClients.ts` | List feedback clients |
| `reputationAuthHash.ts` | Generate SIP-018 auth hash |
| `validationStatus.ts` | Get validation status |
| `validationSummary.ts` | Get validation summary |
| `validationList.ts` | List validations |
| `validationRequests.ts` | List validation requests |

## ERC-8004 Overview

Interface for the Stacks implementation of ERC-8004 agent registries:

- **Identity**: Query agent metadata, URIs, and ownership
- **Reputation**: View feedback summaries and client interactions
- **Validation**: Check validation status and history
- **Auth**: Generate SIP-018 structured data for feedback submission

## Endpoints

### Identity Registry

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/registry` | GET | Contract addresses (free) |
| `/agent/info` | POST | Agent info by ID |
| `/agent/owner` | GET | Agent owner |
| `/agent/uri` | GET | Agent URI |
| `/agent/metadata` | POST | Metadata by key |
| `/agent/version` | GET | Registry version |
| `/agent/lookup` | POST | Find by owner |

### Reputation Registry

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/reputation/summary` | POST | Reputation summary |
| `/agent/reputation/feedback` | POST | Specific feedback |
| `/agent/reputation/list` | POST | All feedback |
| `/agent/reputation/clients` | POST | Feedback clients |
| `/agent/reputation/auth-hash` | POST | Generate auth hash |

### Validation Registry

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/validation/status` | POST | Validation status |
| `/agent/validation/summary` | POST | Validation summary |
| `/agent/validation/list` | POST | List validations |
| `/agent/validation/requests` | POST | List requests |

## Pricing

All agent endpoints use the `simple` tier (0.001 STX), except `/agent/registry` which is free.

## Relationships

- **Uses**: `src/utils/erc8004.ts` for contract addresses
- **Uses**: `src/utils/hiro.ts` for blockchain queries

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/agent)*
