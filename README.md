# Passport Agent Protocol (PAP)

> **Your agent has a passport. You grant it visas from your phone. Services let it through without knowing who you are.**

Human-in-the-loop authorization for AI agents, on-chain. Built at **Ethereum Builders Tour: Cali** (Sep 19–20, 2026 · Ethereum Applications Guild × HashKey Chain × ETH Cali).

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
2. It calls the PAP **MCP tool** → gets a QR + deep link.
3. Human scans it on the **PWA** (`pap.devcristobalvc.com`) → sees a plain-language request → confirms with **passkey / FaceID**.
4. The phone signs the transaction on **HashKey Chain**.
5. The relay hands the tx hash back to the agent, which carries on.

The human→agent link and every granted permission live on-chain (`IdentityRegistry` + `AgentPassport`), so any service can verify "this agent is authorized by a real human for this scope" — without learning who the human is.

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
                                                            │  IdentityRegistry│ (ERC-8004)
                                                            │  AgentPassport   │ (visas)
                                                            │  DemoUSDT        │
                                                            └──────────────────┘
```

- **Agent side** never holds a private key. It only talks MCP.
- **Relay** is stateless glue: it stores pending requests, serves the QR, and returns the signed result. It cannot sign.
- **Phone** holds the key (passkey-protected). It is the only thing that can produce a signature.
- **Chain** is the source of truth for *who* authorized *which agent* for *what scope*.

## Monorepo layout

```
contracts/   Foundry — IdentityRegistry (ERC-8004), AgentPassport, DemoUSDT,
             Groth16Verifier + PassportRegistry (phase 3 ZK)
web/         Next.js — PWA (approve screen, passkey, signer) + relay API routes
mcp/         PAP MCP server — tools: pap_request_payment, pap_request_permission, pap_status
docs/        STATE_OF_THE_ART.md, PITCH.md, DEMO.md
scripts/     Fixture / tooling scripts
deployments/ Contract addresses per network
todo.md      Iterative plan & status
```

## Chain

HashKey Chain Testnet · chainId `133` · RPC `https://testnet.hsk.xyz` · explorer `https://hashkeychain-testnet-explorer.alt.technology` · faucet 0.01 HSK/day

Deployed addresses: `deployments/hashkey-testnet.json`.

## Run

```bash
# contracts
cd contracts && forge build && forge test

# web (PWA + relay)
cd web && npm install && npm run dev        # http://localhost:3000

# mcp server (register in Claude Code)
cd mcp && npm install && npm run build
claude mcp add pap -- node ./mcp/dist/index.js
```

Then, inside Claude Code: *"pay 5 demoUSDT to 0x… for the oracle call"* → the agent calls `pap_request_payment` → scan the QR with your phone → approve → the agent receives the tx hash.

## Tracks

- **EAG — AI × Ethereum & Agent Economy**: agent wallets, agent payments with a verifiable human in the loop.
- **HashKey Chain — AI Agents / Payments**: compliant-but-private authorization rail on HSK.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1 — Onboarding + approved payment** | Register agent (ERC-8004), link phone, approve a USDT transfer from iPhone via MCP | in progress |
| **2 — x402-style gate** | API returns `402`; agent presents on-chain permission; gate verifies `AgentPassport` and returns `200` | next |
| **3 — ZK passport** | Prove "I'm an authorized agent" via Groth16 membership over the passport set (`zkpjwt-core`, `PassportRegistry`) without revealing *which* agent — see `docs/STATE_OF_THE_ART.md` | researched, contracts + tests done |
| Later | Nullifier inside the circuit, RIP-7212 / AA so the passkey signs on-chain directly, agent-to-agent payments | — |

## Team

- Cristóbal Valencia — [@DevCristobalvc](https://github.com/DevCristobalvc) — product, pitch, docs
- Juan — `web/` + `mcp/`
- William — `contracts/` + HashKey deploy

## License

MIT
