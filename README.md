# Anonymous Agent Passport

> **Prove you're a trusted agent. Don't say which one.**

ZK membership proofs over ERC-8004 agent reputation sets, gating x402-style paid APIs — on HashKey Chain.

Built at **Ethereum Builders Tour: Cali** (Sep 19–20, 2026 · Ethereum Applications Guild × HashKey Chain).

## Why

- **ERC-8004** gives agents on-chain identity + reputation, but every action is linkable to a public `agentId`.
- **x402** gives agents a way to pay per request, but no way to prove they are vetted.
- **Anonymous Agent Passport** joins both: an issuer publishes a Merkle root of vetted agents; an agent proves membership with a Groth16 proof (client-side, [`zkpjwt-core`](https://www.npmjs.com/package/zkpjwt-core)) and gets through a `402 → 200` gate without revealing which agent it is.

## Layout

```
contracts/   Foundry — ERC-8004 minimal registries, Groth16Verifier, PassportRegistry
web/         Next.js — registry UI, passport prover, x402-style gate (/api/oracle)
docs/        State of the art, architecture
todo.md      Plan & status
```

## Chain

HashKey Chain Testnet · chainId `133` · RPC `https://testnet.hsk.xyz` · explorer `https://hashkeychain-testnet-explorer.alt.technology`

## Run

```bash
# contracts
cd contracts && forge build && forge test

# web
cd web && npm install && npm run dev
```

Deployed addresses: see `deployments/hashkey-testnet.json` (coming).

## Team

Cristobal Valencia — [@DevCristobalvc](https://github.com/DevCristobalvc)
