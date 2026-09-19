# Passport Agent Protocol (PAP)

> **Your agent has a passport. You grant it visas from your phone. Services let it through without knowing who you are.**

Human-in-the-loop authorization for AI agents, on-chain. **Live on HashKey Chain testnet** — PWA at [pap.devcristobalvc.com](https://pap.devcristobalvc.com), MCP server in this repo, end-to-end flow verified ([example payment tx](https://testnet-explorer.hskchain.net/tx/0xe15228455c80cd4c6e9a2229ab774e5d36ebd9e1ce63cf19cdefcfaec7b04e23)). Built at **Ethereum Builders Tour: Cali** (Sep 19–20, 2026 · Ethereum Applications Guild × HashKey Chain × ETH Cali).

## The problem

Today an AI agent (Claude Code, a trading bot, an A2A worker) has exactly two options for touching money or signing anything:

| Option | What it means |
|---|---|
| Private key in `.env` | The agent can do **everything**, forever, with no human check. One prompt injection away from draining the wallet. |
| No key | The agent can do **nothing**. You end up copy-pasting transactions by hand. |

There is no middle ground: no way for a human to approve *this specific action* from a device they trust, and no verifiable record of *who* authorized *which* agent to do *what*.

## The solution

PAP gives the agent an on-chain **passport** (ERC-8004 identity) and lets the human stamp **visas** (scoped permissions) on it from their phone with FaceID/passkey. The agent never sees a secret.

1. Agent needs to pay for an API / send USDT / call a contract.
2. It calls the PAP **MCP tool** (`pap_transfer`) → gets a QR + link.
3. Human scans it on the **PWA** (`pap.devcristobalvc.com`) → sees a plain-language request → confirms with **passkey / FaceID**.
4. The phone signs **one transaction** on **HashKey Chain**: `AgentPassport.pay(agentId, token, to, amount, ref)` — transfer + permission check + usage record in one call. Over the limit? It reverts on-chain (`LimitExceeded()`).
5. The relay hands the tx hash back to the agent, which carries on.

The human→agent link is the ERC-8004 registration itself (`IdentityRegistry.register(agentURI, agentWallet)` — the human is the NFT owner, the agent only has a public address). Every permission is a **grant** on `AgentPassport` (`grant(agentId, scope, limit, expiry)`, we call them *visas*). Any service can check `canAct(agentId, scope, amount)` — "this agent is authorized by a real human for this scope" — without learning who the human is.

**For HashKey Chain: compliant but private.** Auditable authorization trail, no exposed identities.

## Architecture

```
┌──────────────┐   MCP (stdio)   ┌──────────────┐   HTTPS   ┌──────────────────┐
│  Claude Code │ ──────────────▶ │  PAP MCP     │ ────────▶ │  Relay API       │
│  (any agent) │ ◀────────────── │  server      │ ◀──────── │  (Next.js/Vercel)│
└──────────────┘  result / hash  └──────────────┘  poll     └────────┬─────────┘
                                                                     │ QR / deep link
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  PWA on iPhone   │
                                                            │  passkey/FaceID  │
                                                            │  signs tx        │
                                                            └────────┬─────────┘
                                                                     │ eth_sendRawTransaction
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  HashKey Chain   │
                                                            │  IdentityRegistry│ (ERC-8004: human = owner, agent = wallet)
                                                            │  AgentPassport   │ (grants / "visas": scope, limit, expiry)
                                                            │  DemoUSDT        │
                                                            └──────────────────┘
```

- **Agent side** never holds a private key. It only talks MCP.
- **Relay** is stateless glue: it stores pending requests, serves the QR, and returns the signed result. It cannot sign.
- **Phone** holds the key (passkey-protected: WebAuthn platform authenticator; with the PRF extension on iOS 18+ the key is AES-GCM encrypted with a secret only the passkey can derive). It is the only thing that can produce a signature.
- **Chain** is the source of truth for *who* authorized *which agent* for *what scope*, and enforces every payment (`pay`) against the grant's limit and expiry.

## Monorepo layout

```
contracts/   Foundry — IdentityRegistry (ERC-8004), AgentPassport, DemoUSDT,
             Groth16Verifier + PassportRegistry (phase 3 ZK)
web/         Next.js — PWA (passkey wallet, pair/approve/show pages) + relay API (Vercel Blob)
mcp/         PAP MCP server — pap_connect, pap_transfer, pap_wait, pap_status, pap_contact_add
.mcp.json    Registers the MCP server in Claude Code when you open the repo
docs/        PITCH.md, DEMO.md, VIDEO.md, SUBMISSION.md, GATE.md, STATE_OF_THE_ART.md, RESOURCES.md
scripts/     Fixture / tooling scripts
deployments/ Contract addresses per network
todo.md      Iterative plan & status
```

## Chain

HashKey Chain Testnet · chainId `133` · RPC `https://testnet.hsk.xyz` · explorer https://testnet-explorer.hskchain.net · faucet https://hskchain.net/faucet

### Deployed (`deployments/133.json`)

| Contract | Address |
|---|---|
| `AgentPassport` | [`0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B`](https://testnet-explorer.hskchain.net/address/0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B) ✅ verified |
| `IdentityRegistry` (ERC-8004) | [`0x9a074B1BD632D93b20BF468Cd23C0a9794F2e50F`](https://testnet-explorer.hskchain.net/address/0x9a074B1BD632D93b20BF468Cd23C0a9794F2e50F) |
| `DemoUSDT` | [`0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84`](https://testnet-explorer.hskchain.net/address/0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84) |
| `ReputationRegistry` | [`0xf935f364f797AF2336FfDb3ee06431e1616B7c6C`](https://testnet-explorer.hskchain.net/address/0xf935f364f797AF2336FfDb3ee06431e1616B7c6C) ✅ verified |
| `PassportRegistry` (phase 3) | [`0x4bB5791e89b4B2aA9D435CCB7F428626c790f10C`](https://testnet-explorer.hskchain.net/address/0x4bB5791e89b4B2aA9D435CCB7F428626c790f10C) |
| `Groth16Verifier` (phase 3) | [`0xEBB0A2188451e702c4905168d465FCCbdf44B229`](https://testnet-explorer.hskchain.net/address/0xEBB0A2188451e702c4905168d465FCCbdf44B229) |

ABIs in `deployments/abi/`.

## Run

```bash
# contracts
cd contracts && forge build && forge test

# web (PWA + relay)
cd web && npm install && npm run dev        # http://localhost:3000

# mcp server (dist/ is committed; rebuild only if you change src/)
cd mcp && npm install && npm run build

# e2e without a phone (simulator approves for you)
node web/scripts/phone-sim.mjs      # in one terminal
node mcp/scripts/e2e.mjs            # in another
```

Open the repo in Claude Code: `.mcp.json` registers the `pap` server pointing at `https://pap.devcristobalvc.com`. The agent's identity (address + name, **no private key**) lives in `~/.pap/agent.json`, created on first `pap_connect`.

Then, inside Claude Code:

1. *"connect to PAP"* → `pap_connect` prints a QR and opens `/show/pair/:id` in your browser → scan with your phone → the phone runs the onboarding (4 txs, see below).
2. *"pay 5 demoUSDT to 0x… for the oracle call"* → `pap_transfer` prints a QR → approve with FaceID → 1 tx → the agent receives the tx hash and explorer link.
3. Optional: `pap_contact_add({name, address})` so you can say *"pay 5 demoUSDT to oracle"*.

### MCP tools

| Tool | What it does |
|---|---|
| `pap_status()` | Agent identity, pairing state, relay health |
| `pap_connect({name?})` | Onboarding: creates a pair request, shows QR, waits for the phone |
| `pap_transfer({to, amount, memo?})` | Payment request; `to` is an address or a contact name; waits up to 5 min; returns `txHash` |
| `pap_wait({kind, id})` | Resume waiting on a pair/request |
| `pap_contact_add({name, address})` | Local address book |

### What the phone signs

**Onboarding (`/pair/:id`, 4 txs):** `IdentityRegistry.register(agentURI, agentWallet)` (phone = NFT owner = the human link; `agentURI` = `/api/agents/<addr>/card`, an ERC-8004 registration file) → `DemoUSDT.faucet()` → `DemoUSDT.approve(AgentPassport, max)` → `AgentPassport.grant(agentId, transferScope(demoUSDT), limit, expiry)`.

**Payment (`/approve/:id`, 1 tx):** `AgentPassport.pay(agentId, token, to, amount, ref = keccak("pap:req:" + requestId))`. The contract checks the grant (scope, limit, expiry), moves the tokens, records usage and emits `Paid`. Verified: 10 demoUSDT → [ok](https://testnet-explorer.hskchain.net/tx/0xe15228455c80cd4c6e9a2229ab774e5d36ebd9e1ce63cf19cdefcfaec7b04e23); 500 demoUSDT → reverts `LimitExceeded()`.

Gas: `/api/fund` sends 0.002 HSK to new phone wallets (testnet only).

### On-chain surface

| Contract | Calls |
|---|---|
| `IdentityRegistry` (ERC-8004) | `register(agentURI, agentWallet) → agentId` (msg.sender = human, owner of the NFT) · `agentIdOf(agentWallet)` |
| `AgentPassport` | `grant(agentId, scope, limit, expiry)` · `revoke(agentId, scope)` · `pay(agentId, token, to, amount, ref)` · `record(agentId, scope, amount, ref)` · `canAct(agentId, scope, amount)` · `getGrant(agentId, scope)` · `transferScope(token)` — scope for token transfers = `transferScope(token)` |
| `DemoUSDT` | 6 decimals · `mint(to, amount)` · `faucet()` = 1,000 |

### Relay API (`web/`, Vercel)

| Endpoint | Purpose |
|---|---|
| `POST /api/pair` `{agentAddress, agentName, sig}` → `{pairId, url}` · `GET /api/pair/:id` · `POST /api/pair/:id/approve` | Onboarding: phone registers the agent + grants |
| `POST /api/requests` `{agentAddress, action:{type:"transfer", token, to, amount, memo}, sig}` → `{requestId, url}` · `GET /api/requests/:id` · `POST /api/requests/:id/resolve` | One action, one approval |
| `GET /api/agents/:address` · `GET /api/agents/:address/card` (ERC-8004 registration file) · `POST /api/fund` · `GET /api/health` | Agent card, gas sponsor, health |
| `/` (wallet + pending) · `/pair/:id`, `/approve/:id` (phone) · `/show/pair/:id`, `/show/request/:id` (big QR on the laptop) | Pages |

## Tracks

- **EAG — AI × Ethereum & Agent Economy**: agent wallets, agent payments with a verifiable human in the loop.
- **HashKey Chain — AI Agents / Payments**: compliant-but-private authorization rail on HSK.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1 — Onboarding + approved payment** | `pap_connect`: register agent (ERC-8004) + grant from the phone; `pap_transfer`: approve a demoUSDT payment from iPhone via MCP, enforced on-chain by `pay()` | **done — live on HSK testnet** |
| **2 — x402-style gate** | `GET /api/gate/oracle` returns `402` + challenge; agent signs it; gate checks `getAgentWallet(agentId)` and `canAct()` on-chain and returns `200` — see `docs/GATE.md` | **done — live** |
| **3 — ZK passport** | Prove "I'm an authorized agent" via Groth16 membership over the passport set (`zkpjwt-core`, `PassportRegistry`) without revealing *which* agent — see `docs/STATE_OF_THE_ART.md` | researched, contracts + tests done |
| Later | Nullifier inside the circuit, RIP-7212 / AA so the passkey signs on-chain directly, agent-to-agent payments | — |

## Team

- Cristóbal Valencia — [@DevCristobalvc](https://github.com/DevCristobalvc) — product, pitch, docs
- Juan — `web/` + `mcp/`
- William — `contracts/` + HashKey deploy

## License

MIT
