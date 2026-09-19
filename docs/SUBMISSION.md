# Devfolio submission — ready to paste

> Platform: https://eag-global-buildathon.devfolio.co (the Cali stop submits here; there is no separate Cali Devfolio).
> **Deadline: Sunday Sep 20, 13:30.** Steps: (1) *Apply now* on the hackathon page (profile is already 100%), (2) *Add project*, (3) paste the fields below, (4) select tracks, (5) submit.
>
> Items marked **[OK CRISTÓBAL]** need his confirmation before pasting.

---

## Project name

```
Passport Agent Protocol
```

## Tagline (≤ 100 chars)

```
Your agent has a passport. You stamp the visas from your phone. HSK Chain enforces them.
```
(87 chars) — alternative, 73 chars: `Give your AI agent a passport. Approve what it does with Face ID, on-chain.`

**[OK CRISTÓBAL]** pick one.

## The problem it solves

```
An AI agent (Claude Code, a trading bot, an A2A worker) that needs to move money or sign anything has exactly two options today:

1. A private key in .env — the agent can do everything, forever, with no human check. One prompt injection away from draining the wallet.
2. No key — the agent can do nothing, and you end up copy-pasting transactions by hand.

There is no middle ground: no way for a human to approve *this specific action* from a device they trust, and no verifiable on-chain record of who authorized which agent to do what. ERC-8004 gives agents identity and reputation, x402 gives them payments, but neither answers "is a real human behind this agent, and what exactly did they allow?"
```

## Description (problem / solution / how it was built / what's next)

```
Passport Agent Protocol (PAP) gives an AI agent an on-chain passport (ERC-8004 identity owned by a human) and lets the human stamp visas on it — scoped, limited, expiring permissions — from their phone with Face ID. The agent never holds a private key. It can only ask.

HOW IT WORKS
1. Connect. Inside Claude Code the agent calls the `pap_connect` MCP tool and shows a QR. The phone signs the onboarding (4 txs): IdentityRegistry.register(agentURI, agentWallet) → DemoUSDT.faucet() → approve(AgentPassport, max) → AgentPassport.grant(agentId, scope, limit, expiry). The human is the owner of the ERC-721; the agent only has a public address.
2. Approve. The agent calls `pap_transfer`. The phone shows the request in plain language and asks for Face ID. The EVM key is protected by a WebAuthn passkey (encrypted with the PRF extension on iOS 18+); it never leaves the device.
3. Executed on HSK Chain. One transaction: AgentPassport.pay(agentId, token, to, amount, ref). The contract checks scope, limit and expiry, moves the tokens and records the usage. Over the limit? It reverts with LimitExceeded() — the rule lives in the contract, not in the app.

TWO MODES, SAME VISA
- Human in the loop: every payment approved on the phone. Verified: 10 demoUSDT approved from an iPhone via MCP (tx 0xe152…b04e23); 500 demoUSDT rejected on-chain.
- Autonomous inside the visa: the human grants once, afterwards the agent key pays alone; limit and expiry still enforced by the contract (tx 0x629de0…c756f, agentId 6, no human signature).

For HashKey Chain this is "compliant but private": any service can verify with one call — canAct(agentId, scope, amount) — that a real human authorized this agent for this scope, without learning who the human is.

HOW IT WAS BUILT (Sep 19–20, Cali)
- contracts/ — Foundry, Solidity 0.8.28. IdentityRegistry + ReputationRegistry (ERC-8004 interface-compatible), AgentPassport (grant / revoke / pay / record / canAct / getGrant), DemoUSDT, plus Groth16Verifier + PassportRegistry for the ZK iteration. 25 unit tests + 3 fork tests against the live HSK testnet deployment. All 6 contracts verified on Blockscout.
- web/ — Next.js 16 on Vercel: the phone PWA (passkey wallet, /pair, /approve, /wallet), the relay API (/api/pair, /api/requests — state on Vercel Blob, no database, no keys server-side), a gas sponsor (/api/fund), and the ERC-8004 registration file per agent (/api/agents/:addr/card).
- mcp/ — a Model Context Protocol server registered via .mcp.json: pap_connect, pap_transfer, pap_wait, pap_status, pap_contact_add. Open the repo in Claude Code and the agent has a "ask permission" tool. Agent identity lives in ~/.pap/agent.json — no private key anywhere on the agent side.
- Phone simulator (web/scripts/phone-sim.mjs) and E2E script (mcp/scripts/e2e.mjs) for CI-style runs without a device.

THE GATE (iteration 2, live)
GET /api/gate/oracle is an x402-shaped border: the first request gets a 402 with a challenge; the agent signs it with its identity key and retries; the gate verifies the signature, checks on-chain that the key is the agent's wallet in IdentityRegistry and that canAct() is true on AgentPassport, and answers 200. Any service can put a "visa required" border in front of an endpoint with ~100 lines and no facilitator.

WHAT'S NEXT
- Iteration 3 — ZK passport: prove "I am an authorized agent" with a Groth16 membership proof (zkpjwt-core, our own npm lib) without revealing which one. Verifier and registry already deployed; research in docs/STATE_OF_THE_ART.md.
- RIP-7212 / account abstraction so the passkey signs on-chain directly; agent-to-agent payments.
```

## Tracks

- **EAG:** AI x Ethereum & Agent Economy
- **HashKey Chain:** AI Agents · Payments  **[OK CRISTÓBAL]** — if the form only allows one HSK track, pick *AI Agents*.

## Tech stack (tags)

```
Solidity, Foundry, ERC-8004, HashKey Chain, Next.js, TypeScript, viem, WebAuthn, Passkeys, PWA, Vercel, Model Context Protocol (MCP), Claude Code, Groth16, snarkjs, Circom
```

## Links

| Field | Value |
|---|---|
| GitHub | https://github.com/DevCristobalvc/ethereum-builders-tour-cali |
| Live app / landing | https://pap.devcristobalvc.com |
| Phone wallet | https://pap.devcristobalvc.com/wallet |
| AgentPassport on explorer | https://testnet-explorer.hskchain.net/address/0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B |
| IdentityRegistry on explorer | https://testnet-explorer.hskchain.net/address/0x9a074B1BD632D93b20BF468Cd23C0a9794F2e50F |
| Human-approved payment tx | https://testnet-explorer.hskchain.net/tx/0xe15228455c80cd4c6e9a2229ab774e5d36ebd9e1ce63cf19cdefcfaec7b04e23 |
| Agent-alone payment tx | https://testnet-explorer.hskchain.net/tx/0x629de0c7927fe7a44796698f1bb8c56d6a6d0f67d3ea1cda19541bc8c15c756f |
| Demo video | **[OK CRISTÓBAL]** YouTube unlisted link — see `docs/VIDEO.md` |
| Pitch | https://github.com/DevCristobalvc/ethereum-builders-tour-cali/blob/main/docs/PITCH.md |
| Gate (x402-shaped) | https://github.com/DevCristobalvc/ethereum-builders-tour-cali/blob/main/docs/GATE.md |

## Cover image / logo

**[OK CRISTÓBAL]** — Devfolio asks for a cover (recommended 1200×630). Simplest: screenshot of the landing hero at https://pap.devcristobalvc.com, or the terminal QR + iPhone approve screen side by side.

## HashKey Chain sponsor fields (if the form asks)

| Field | Value |
|---|---|
| Network | HashKey Chain Testnet, chainId 133 |
| Deployed contract addresses | see table in README.md / `deployments/133.json` (6 contracts, all verified on https://testnet-explorer.hskchain.net) |
| Why HashKey Chain | OP-stack EVM L2 with a compliance / RWA / regulated-stablecoin narrative — the exact context where "an agent moved money and nobody knows who authorized it" is unacceptable. PAP is an auditable-but-private authorization rail for agent payments on HSK. |
| Use of HSK / stablecoins | Payments in demoUSDT (6-dec ERC-20 standing in for a regulated stablecoin); gas in HSK, sponsored for new phone wallets via /api/fund. |

## Team

**[OK CRISTÓBAL]** — Devfolio adds teammates by Devfolio username. Confirm whether Juan and William have accounts and want to be added, or if it goes as a solo submission with credits in the README.

- Cristóbal Valencia — @DevCristobalvc — product, pitch, docs, submission
- Juan — web/ + mcp/
- William — contracts/ + HSK deploy

## Pre-submit checklist

- [ ] *Apply now* done (hackathon page → application 100% → Submit application)
- [ ] Project created with the fields above
- [ ] Tracks selected (EAG + HSK)
- [ ] Video link added (unlisted YouTube)
- [ ] Cover image uploaded
- [ ] Teammates added (or decided solo)
- [ ] Repo is public and README addresses are current
- [ ] Submitted before **Sun 13:30** — then share the Devfolio project link in the event Telegram (https://t.me/ethcali)
