# Passport Agent Protocol (PAP) — Hackathon Plan

Ethereum Builders Tour Cali · 2026-09-19/20 · HashKey Chain testnet (chainId 133)

> ## ⏰ DEADLINE: **DOMINGO 20 SEP, 13:30** ⏰
> Entrega en el Devfolio **global**: https://eag-global-buildathon.devfolio.co (confirmado en ethcali.org/builders-tour — no hay Devfolio de Cali).
> Demo showcase 13:30–17:00 (3 min demo + 2 min Q&A) · Jurado 17:00 · Premios 17:30.
> Premios: EAG 5×200 USDT + beca ShanHaiWoo · EF tickets Devcon VIII · HashKey 500/300/200 USDT.
> Tracks: EAG *AI x Ethereum & Agent Economy* · HSK *AI Agents* / *Payments*.

Stack: Foundry (Solidity) · Next.js + TypeScript (PWA + relay, Vercel) · viem · WebAuthn/passkeys · MCP SDK · zkpjwt-core (phase 3)

Pitch: **"Your agent has a passport. You grant it visas from your phone. Services let it through without knowing who you are."**

Split: **juan** = `web/` + `mcp/` · **william** = `contracts/` + HSK deploy · **cristóbal** = README, todo, pitch, demo, submission.

---

## Reused from v1 (done)

### T0 — Repo & tooling
- **status:** done
- **description:** GitHub repo `DevCristobalvc/ethereum-builders-tour-cali`, monorepo (`contracts/`, `web/`, `mcp/`, `docs/`), Foundry, `.gitignore`.
- **acceptance:** `git push` works; `forge build` runs.

### T1 — ERC-8004 minimal registries (Solidity)
- **status:** done
- **description:** `IdentityRegistry` (ERC-721, `register(string agentURI, address agentWallet) -> agentId`, `getAgentWallet`, `agentIdOf(agentWallet)`), `ReputationRegistry` (`giveFeedback`, `getSummary`).
- **acceptance:** agent registers, gets `agentId`; wallet <-> agentId resolvable both ways. Foundry tests pass.
- **comments:** this is the "passport" itself **and the human->agent link**: `msg.sender` of `register` is the human (owner of the NFT), `agentWallet` is the agent's public address (no key on the agent side — the phone signs *for* it, see T6). No separate "linkHuman".

### T2 — Groth16 verifier + PassportRegistry (Solidity)
- **status:** done (parked for Iter 3)
- **description:** `Groth16Verifier.sol` from `zkpjwt-core` zkey, `PassportRegistry` (`publishRoot`, `checkPassport`, `verifyPassport` with nullifier per `serviceId`). 9/9 tests with a real proof fixture (`scripts/gen-fixture.mjs`).
- **comments:** not on the Iter 1/2 critical path. Keep compiled + tested so the ZK story is credible in the roadmap slide.

---

## Iteration 1 — Onboarding + payment approved from iPhone (MVP for demo)

### T3 — `AgentPassport` contract (william)
- **status:** done (+ `pay(agentId, token, to, amount, ref)` = transfer + check + record in 1 tx, `Paid` event, `transferScope(token)`; reverts `LimitExceeded()` over limit)
- **description:** `AgentPassport.sol`: `grant(agentId, bytes32 scope, uint256 limit, uint64 expiry)` onlyOwner (NFT owner) -> `PermissionGranted`; `revoke(agentId, scope)` -> `PermissionRevoked`; `record(agentId, scope, amount, bytes32 ref)` (owner or agentWallet) -> `ActionRecorded`; `canAct(agentId, scope, amount) view`; `getGrant(agentId, scope) view`. Scope = `keccak256("transfer:demoUSDT")`. In docs we call a grant a *visa* (metaphor only).
- **acceptance:** only the NFT owner can grant/revoke; `canAct` false after expiry / over limit (limit minus recorded usage); Foundry tests.
- **tests:** grant -> canAct true; revoke -> false; record up to limit -> next canAct false; expired -> false; non-owner grant reverts; record from random address reverts.
- **comments:** keep it tiny. The demo needs `grant` + `record` + `canAct`.

### T4 — `DemoUSDT` + deploy to HashKey testnet (william)
- **status:** done — `deployments/133.json`, ABIs in `deployments/abi/`, explorer https://testnet-explorer.hskchain.net
- **description:** `DemoUSDT.sol` (exists, 6 decimals, public `faucet()`). `Deploy.s.sol` deploys IdentityRegistry, ReputationRegistry, AgentPassport, DemoUSDT (PassportRegistry optional). Write `deployments/133.json` + explorer links in README.
- **acceptance:** all addresses live on explorer; `cast call canAct` works (done); faucet gives demoUSDT to the phone address.
- **comments:** get HSK from faucet **early** (0.01 HSK/day). Fund phone address + a spare.

### T5 — Relay API (juan, `web/src/app/api/*`)
- **status:** done — live at https://pap.devcristobalvc.com, state in Vercel Blob, plus `/api/fund` (gas sponsor 0.002 HSK), `/api/agents/:addr/card` (ERC-8004 registration file), `/api/health`
- **description:** Pairing: `POST /api/pair {agentAddress, agentName, sig}` -> `{pairId, url}`; `GET /api/pair/:id` -> `{status: pending|approved, ownerAddress?, agentId?, txHash?}`; `POST /api/pair/:id/approve`. Actions: `POST /api/requests {agentAddress, action:{type:"transfer", token, to, amount, memo}, sig}` -> `{requestId, url}`; `GET /api/requests/:id` -> `{status: pending|approved|rejected|expired, txHash?}`; `POST /api/requests/:id/resolve`. Pages: `/` (wallet + pending), `/pair/:id`, `/approve/:id` (iPhone), `/show/pair/:id` + `/show/request/:id` (big QR on laptop, MCP opens it automatically). Storage: in-memory or Vercel KV. No keys server-side.
- **acceptance:** curl flow create -> poll -> phone resolves -> poll returns `approved` + `txHash`.
- **tests:** route unit tests; one integration run against Vercel preview.
- **comments:** deploy to Vercel from day 1 so the phone can reach it over the internet (ICESI wifi is not localhost). Domain `pap.devcristobalvc.com`.

### T6 — PWA on iPhone (juan, `web/src/app/*`)
- **status:** done — E2E verified on HSK testnet (10 demoUSDT approved, tx 0xe152…b04e23; 500 demoUSDT reverts on-chain). Phone simulator for plan B: `web/scripts/phone-sim.mjs`
- **description:** Installable PWA. Screens: (1) **Onboard** — create passkey (WebAuthn), derive/hold an EOA in the device (key wrapped by the passkey, stored in IndexedDB), show address + faucet button; (2) **`/pair/:id`** — 4 txs from the phone: `register(agentURI, agentWallet)` (phone = NFT owner = human link; `agentURI` = `/api/agents/<addr>/card`) -> `DemoUSDT.faucet()` -> `approve(AgentPassport, max)` -> `grant(agentId, transferScope(demoUSDT), limit, expiry)`, then `POST /api/pair/:id/approve`; (3) **`/approve/:id`** — opens from QR, shows request in plain language ("Claude Code wants to send 5 demoUSDT to 0x..."), FaceID -> 1 tx `AgentPassport.pay(agentId, token, to, amount, ref=keccak("pap:req:"+requestId))` -> `POST /api/requests/:id/resolve`.
- **acceptance:** end-to-end on a real iPhone over Safari: scan -> FaceID -> tx on explorer -> agent gets hash, in < 30 s.
- **tests:** manual on device (Safari PWA). Playwright optional.
- **comments:** passkey protects the key **in the device**; it does not sign on-chain itself (see PITCH.md Q&A). Keep UI: one big green "Approve" and one red "Reject".

### T7 — MCP server (juan, `mcp/`)
- **status:** done — `.mcp.json` committed, `mcp/dist` committed, E2E script `mcp/scripts/e2e.mjs`
- **description:** Node MCP server (stdio). Tools: `pap_status()`, `pap_connect({name?})` (onboarding: creates pair, prints QR, opens `/show/pair/:id` in the browser, waits), `pap_transfer({to, amount, memo?})` (`to` = 0x or contact name; prints QR, waits up to 5 min, returns `{txHash, explorerUrl}`), `pap_wait({kind, id})`, `pap_contact_add({name, address})`. Config: `.mcp.json` at repo root (`node mcp/dist/index.js`, env `PAP_RELAY_URL=https://pap.devcristobalvc.com`). Agent identity in `~/.pap/agent.json`, not in env.
- **acceptance:** open Claude Code in the repo -> "connect to PAP" -> QR -> pair on phone; then "pay 5 demoUSDT to 0x..." -> QR -> approve on phone -> Claude prints the explorer link.
- **tests:** vitest for request/poll logic with mocked relay.
- **comments:** this is the "wow" moment of the demo. Make the QR big in the terminal.

### T8 — Docs, pitch, demo, submission (cristóbal)
- **status:** in progress — docs updated with live addresses/tx; **pending: Devfolio apply + project submission, plan-B video**
- **description:** README (done), `docs/PITCH.md` (done), `docs/DEMO.md` (done), record 3-min video (plan B), Devfolio project submission with tracks EAG *AI x Ethereum & Agent Economy* + HSK *AI Agents / Payments*.
- **acceptance:** submission live on Devfolio before Sun 13:30; video uploaded; README addresses filled.
- **comments:** apply to the buildathon first (profile is 100%), then create the project.

---

## Iteration 2 — x402-style gate that verifies permission on-chain

### T9 — Gate API (`web/app/api/oracle`)
- **status:** todo
- **description:** `GET /api/oracle` -> `402` `{accepts:[{scheme:"pap-grant", scope, agentPassport, chainId:133}]}`. Retry with `X-PAP-AGENT: agentId` + `X-PAP-SIG: sig over challenge` -> server checks `canAct(agentId, scope, amount)` via viem read + signature recovers to `getAgentWallet(agentId)` -> `200` + payload, and `record`s the usage. Optional `X-PAYMENT: txHash` of a demoUSDT transfer.
- **acceptance:** curl 402 -> 200 with a grant; 403 without / after `revoke`.
- **comments:** mimic x402 header shape so judges recognize it; no external facilitator (none support HSK).

### T10 — MCP tool `pap_call_gated_api`
- **status:** todo
- **description:** agent hits the gate, on 402 asks the phone (via relay) for a one-shot signature/permission, retries, returns the payload.

---

## Iteration 3 — ZK passport (privacy)

### T11 — Anonymous membership
- **status:** researched (T2 contracts done)
- **description:** issuer publishes Merkle root of agents with valid visas (`PassportRegistry.publishRoot`); agent proves membership with Groth16 in the browser/MCP (`zkpjwt-core`); gate verifies proof + nullifier. Service learns "authorized agent", not *which*. Details: `docs/STATE_OF_THE_ART.md`.
- **comments:** circuit currently has no nullifier signal -> v1 nullifier off-chain. Stretch: nullifier in circuit, RIP-7212 so the passkey signs on-chain, agent-to-agent payments.

---

## Timeline (Sat 14:00 -> Sun 13:30)

| When | juan | william | cristóbal |
|---|---|---|---|
| Sat 14–17 | T5 relay on Vercel + PWA onboard + pair (done) | T3 AgentPassport + tests (done) | README/todo/pitch/demo (done), Devfolio apply |
| Sat 17–21 | T6 approve screen + signer on iPhone (done), T7 MCP (done) | T4 deploy HSK, faucet, addresses (done) | addresses -> README (done), video script |
| Sat 21–00 | T7 MCP server | help T6 (viem tx build) | dry-run demo, record plan-B video |
| Sun 08–11 | e2e polish, error states | T9 gate if time | Devfolio project submission |
| Sun 11–13:30 | freeze, rehearse x3 | freeze | submit, slides |
