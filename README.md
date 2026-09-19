# Passport Agent Protocol (PAP)

> **Your agent has a passport. You stamp the visas from your phone. Services let it through without knowing who you are.**

Human-in-the-loop authorization for AI agents, enforced on-chain. **Live on HashKey Chain testnet**: landing + phone app at [pap.devcristobalvc.com](https://pap.devcristobalvc.com), MCP server in this repo, six verified contracts.

Built at **Ethereum Builders Tour: Cali** (Sep 19–20, 2026 · Ethereum Applications Guild × HashKey Chain × ETH Cali).

## The problem

An AI agent (Claude Code, a trading bot, an A2A worker) that needs to move money has two options today: a private key in `.env` — it can do **everything**, forever, one prompt injection away from draining the wallet — or **no key**, and you copy-paste transactions by hand. There is no way for a human to approve *this specific action* from a device they trust, with a verifiable on-chain record of *who* authorized *which* agent to do *what*.

## How it works

1. **Connect.** The agent calls the `pap_connect` MCP tool and shows a QR. Your phone signs the onboarding (4 txs): it registers the agent as an **ERC-8004** identity — you own the NFT, the agent only has a public address — and **grants a visa**: `AgentPassport.grant(agentId, scope, limit, expiry)`.
2. **Approve with Face ID.** The agent calls `pap_transfer`. Your phone shows the request in plain language and asks for Face ID. The key is protected by a WebAuthn passkey (PRF-encrypted on iOS 18+) and never leaves the device.
3. **Executed on HSK Chain.** One transaction: `AgentPassport.pay(agentId, token, to, amount, ref)`. The contract checks scope, limit and expiry, moves the tokens and records usage. Over the limit? It **reverts on-chain** with `LimitExceeded()` — the rule is in the contract, not in the app.

Any service can verify with one call — `canAct(agentId, scope, amount)` — that a real human authorized this agent for this scope, without learning who the human is. **Compliant but private.**

### Two modes, same visa

| Mode | What happens | Proof |
|---|---|---|
| **Human in the loop** | Every payment approved on the phone. 10 demoUSDT approved from an iPhone via MCP; 500 demoUSDT rejected on-chain. | [tx 0xe152…b04e23](https://testnet-explorer.hskchain.net/tx/0xe15228455c80cd4c6e9a2229ab774e5d36ebd9e1ce63cf19cdefcfaec7b04e23) |
| **Autonomous, inside the visa** | Human grants once; afterwards the agent key pays alone. Limit and expiry still enforced by the contract. | [tx 0x629de0…c756f](https://testnet-explorer.hskchain.net/tx/0x629de0c7927fe7a44796698f1bb8c56d6a6d0f67d3ea1cda19541bc8c15c756f) |

### The gate (iteration 2)

`GET /api/gate/oracle` is an x402-shaped border: `402` + challenge → the agent signs it with its identity key → the gate checks `getAgentWallet(agentId)` and `canAct()` on-chain → `200`. The agent calls it with `pap_call_gate` — no human involved, because the visa is active on-chain. ~100 lines, no facilitator. Details: [`docs/GATE.md`](docs/GATE.md).

## Try it (zero install)

```bash
git clone https://github.com/DevCristobalvc/ethereum-builders-tour-cali
cd ethereum-builders-tour-cali
claude            # open Claude Code here → approve the "pap" MCP server from .mcp.json
```

Then, in Claude Code:

1. *"connect to PAP"* → QR → scan with your phone → onboarding (4 txs, testnet gas sponsored).
2. *"pay 5 demoUSDT to 0x… for the oracle call"* → QR → Face ID → 1 tx → the agent gets the tx hash.
3. *"call the gated oracle"* → `pap_call_gate` → 402 → signed challenge → 200.

The MCP server is a standalone bundle (`mcp/dist/pap.mjs`, committed). The agent's identity lives in `~/.pap/agent.json` — **no private key anywhere on the agent side**. Other MCP clients: `command: node`, `args: ["<repo>/mcp/dist/pap.mjs"]`, `env: PAP_RELAY_URL=https://pap.devcristobalvc.com`.

No phone? `node web/scripts/phone-sim.mjs` approves for you; `node mcp/scripts/e2e.mjs` runs the whole flow (pair → pay → `LimitExceeded` → gate).

## Architecture

```
Claude Code ──MCP──▶ PAP MCP server ──HTTPS──▶ Relay (Next.js / Vercel Blob)
     ▲                                              │ QR
     │ tx hash                                      ▼
     │                                    PWA on iPhone (passkey / Face ID)
     │                                              │ signs pay()
     └──────────────────────────────────── HashKey Chain: IdentityRegistry · AgentPassport · DemoUSDT
```

- **Agent** never holds a spending key. **Relay** cannot sign. **Phone** is the only signer. **Chain** enforces every permission.
- Full component/API reference: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Deployed on HashKey Chain testnet (chainId 133)

| Contract | Address |
|---|---|
| `AgentPassport` — the visa | [`0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B`](https://testnet-explorer.hskchain.net/address/0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B) |
| `IdentityRegistry` — ERC-8004 | [`0x9a074B1BD632D93b20BF468Cd23C0a9794F2e50F`](https://testnet-explorer.hskchain.net/address/0x9a074B1BD632D93b20BF468Cd23C0a9794F2e50F) |
| `DemoUSDT` | [`0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84`](https://testnet-explorer.hskchain.net/address/0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84) |
| `ReputationRegistry` — ERC-8004 | [`0xf935f364f797AF2336FfDb3ee06431e1616B7c6C`](https://testnet-explorer.hskchain.net/address/0xf935f364f797AF2336FfDb3ee06431e1616B7c6C) |
| `PassportRegistry` — ZK (iter. 3) | [`0x4bB5791e89b4B2aA9D435CCB7F428626c790f10C`](https://testnet-explorer.hskchain.net/address/0x4bB5791e89b4B2aA9D435CCB7F428626c790f10C) |
| `Groth16Verifier` — ZK (iter. 3) | [`0xEBB0A2188451e702c4905168d465FCCbdf44B229`](https://testnet-explorer.hskchain.net/address/0xEBB0A2188451e702c4905168d465FCCbdf44B229) |

All verified on [Blockscout](https://testnet-explorer.hskchain.net). RPC `https://testnet.hsk.xyz` · faucet https://hskchain.net/faucet · addresses + ABIs in `deployments/`.

## Repo

```
contracts/   Foundry — ERC-8004 registries, AgentPassport, DemoUSDT, ZK verifier · 25 unit + 3 fork tests
web/         Next.js — landing, phone PWA (/wallet), relay API, gate (/api/gate/oracle)
mcp/         MCP server (pap_connect, pap_transfer, pap_call_gate, pap_wait, pap_status, pap_contact_add)
.mcp.json    Registers the MCP server when you open the repo in Claude Code
deployments/ Addresses (133.json) + ABIs
docs/        ARCHITECTURE · GATE · PITCH · DEMO · VIDEO · SUBMISSION · STATE_OF_THE_ART · RESOURCES
```

Develop: `cd contracts && forge test` · `cd web && npm i && npm run dev` · `cd mcp && npm i && npm run build` (only if you change `mcp/src`).

## Tracks

- **EAG — AI × Ethereum & Agent Economy**: agent wallets and payments with a verifiable human in the loop, on ERC-8004.
- **HashKey Chain — AI Agents / Payments**: an auditable-but-private authorization rail for agent payments on HSK.

## Roadmap

| Iteration | Scope | Status |
|---|---|---|
| **1 — Passport + visa + Face ID payment** | ERC-8004 registration from the phone, `grant`, `pay()` enforced on-chain, MCP tools | **live** |
| **2 — x402-style gate** | `402` → signed challenge → on-chain visa check → `200`; `pap_call_gate` | **live** |
| **3 — ZK passport** | Prove "I'm an authorized agent" with a Groth16 membership proof (`zkpjwt-core`) without revealing which one. Verifier + registry deployed. | contracts + tests done |
| Later | RIP-7212 / AA so the passkey signs on-chain directly · agent-to-agent payments · nullifier in-circuit | — |

## Team

Cristóbal Valencia — [@DevCristobalvc](https://github.com/DevCristobalvc) (product, pitch, docs) · Juan (`web/`, `mcp/`) · William (`contracts/`, HSK deploy)

MIT
