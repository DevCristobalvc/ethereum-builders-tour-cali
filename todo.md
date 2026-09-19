# Passport Agent Protocol (PAP) — Hackathon Plan

Ethereum Builders Tour Cali · 2026-09-19/20 · HashKey Chain testnet (chainId 133)
**Submission deadline: Sun Sep 20, 13:30** (Devfolio: eag-global-buildathon.devfolio.co) · Demo 13:30–17:00 (3 min + 2 Q&A)

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
- **description:** `IdentityRegistry` (ERC-721, `register(agentURI[, agentWallet])`, `getAgentWallet`, `agentIdOf`), `ReputationRegistry` (`giveFeedback`, `getSummary`).
- **acceptance:** agent registers, gets `agentId`; wallet <-> agentId resolvable both ways. Foundry tests pass.
- **comments:** this is the "passport" itself. `agentWallet` = the agent's public address (no key on the agent side — the phone signs *for* it, see T6).

### T2 — Groth16 verifier + PassportRegistry (Solidity)
- **status:** done (parked for Iter 3)
- **description:** `Groth16Verifier.sol` from `zkpjwt-core` zkey, `PassportRegistry` (`publishRoot`, `checkPassport`, `verifyPassport` with nullifier per `serviceId`). 9/9 tests with a real proof fixture (`scripts/gen-fixture.mjs`).
- **comments:** not on the Iter 1/2 critical path. Keep compiled + tested so the ZK story is credible in the roadmap slide.

---

## Iteration 1 — Onboarding + payment approved from iPhone (MVP for demo)

### T3 — `AgentPassport` contract (william)
- **status:** todo
- **description:** `AgentPassport.sol`: `linkHuman(agentId, humanSigner)` (owner of the ERC-721 sets the phone address as authorized signer), `grantVisa(agentId, scope, limit, expiry)`, `revokeVisa(agentId, scope)`, `hasVisa(agentId, scope, amount) -> bool`, events `HumanLinked`, `VisaGranted`, `VisaRevoked`, `VisaUsed`. Scopes as `bytes32` (e.g. `keccak("pay:demoUSDT")`).
- **acceptance:** only the linked human can grant/revoke; `hasVisa` false after expiry / over limit; Foundry tests.
- **tests:** grant -> hasVisa true; revoke -> false; over-limit -> false; non-human caller reverts.
- **comments:** keep it tiny. The demo needs `linkHuman` + `grantVisa` + `hasVisa`.

### T4 — `DemoUSDT` + deploy to HashKey testnet (william)
- **status:** todo
- **description:** `DemoUSDT.sol` (exists, 6 decimals, public `faucet()`). `Deploy.s.sol` deploys IdentityRegistry, ReputationRegistry, AgentPassport, DemoUSDT (PassportRegistry optional). Write `deployments/hashkey-testnet.json` + explorer links in README.
- **acceptance:** all addresses live on explorer; `cast call hasVisa` works; faucet gives demoUSDT to the phone address.
- **comments:** get HSK from faucet **early** (0.01 HSK/day). Fund phone address + a spare.

### T5 — Relay API (juan, `web/app/api/*`)
- **status:** todo
- **description:** `POST /api/requests` (agent creates request: `{agentId, kind:"pay"|"permission", to, amount, scope, memo}` -> `{id, qrUrl, deepLink}`), `GET /api/requests/:id` (status: `pending|approved|rejected|sent`, `txHash`), `POST /api/requests/:id/result` (phone posts signed tx / hash). Storage: in-memory or Vercel KV. No keys server-side.
- **acceptance:** curl flow create -> poll -> phone posts result -> poll returns `sent` + hash.
- **tests:** route unit tests; one integration run against Vercel preview.
- **comments:** deploy to Vercel from day 1 so the phone can reach it over the internet (ICESI wifi is not localhost). Domain `pap.devcristobalvc.com`.

### T6 — PWA on iPhone (juan, `web/app/*`)
- **status:** todo
- **description:** Installable PWA. Screens: (1) **Onboard** — create passkey (WebAuthn), derive/hold an EOA in the device (key wrapped by the passkey, stored in IndexedDB), show address + faucet button; (2) **Link** — register agent on IdentityRegistry from the phone (phone = owner), `linkHuman`, `grantVisa(pay:demoUSDT, limit 100)`; (3) **Approve** — opens from QR/deep link, shows request in plain language ("Claude Code wants to send 5 demoUSDT to 0x..."), FaceID -> sign + `eth_sendRawTransaction` to HSK -> POST result to relay.
- **acceptance:** end-to-end on a real iPhone over Safari: scan -> FaceID -> tx on explorer -> agent gets hash, in < 30 s.
- **tests:** manual on device (Safari PWA). Playwright optional.
- **comments:** passkey protects the key **in the device**; it does not sign on-chain itself (see PITCH.md Q&A). Keep UI: one big green "Approve" and one red "Reject".

### T7 — MCP server (juan, `mcp/`)
- **status:** todo
- **description:** Node MCP server (stdio). Tools: `pap_request_payment({to, amount, memo})`, `pap_request_permission({scope, limit})`, `pap_status({id})`. Each creates a relay request, prints QR (ASCII) + link in the tool result, then polls until `sent`/`rejected` (timeout 120 s) and returns `{txHash, explorerUrl}`. Config via env: `PAP_RELAY_URL`, `PAP_AGENT_ID`.
- **acceptance:** `claude mcp add pap -- node mcp/dist/index.js` -> in Claude Code "pay 5 demoUSDT to 0x..." -> QR appears -> approve on phone -> Claude prints the explorer link.
- **tests:** vitest for request/poll logic with mocked relay.
- **comments:** this is the "wow" moment of the demo. Make the QR big in the terminal.

### T8 — Docs, pitch, demo, submission (cristóbal)
- **status:** in progress
- **description:** README (done), `docs/PITCH.md` (done), `docs/DEMO.md` (done), record 3-min video (plan B), Devfolio project submission with tracks EAG *AI x Ethereum & Agent Economy* + HSK *AI Agents / Payments*.
- **acceptance:** submission live on Devfolio before Sun 13:30; video uploaded; README addresses filled.
- **comments:** apply to the buildathon first (profile is 100%), then create the project.

---

## Iteration 2 — x402-style gate that verifies permission on-chain

### T9 — Gate API (`web/app/api/oracle`)
- **status:** todo
- **description:** `GET /api/oracle` -> `402` `{accepts:[{scheme:"pap-visa", scope, agentPassport, chainId:133}]}`. Retry with `X-PAP-AGENT: agentId` + `X-PAP-SIG: sig over challenge` -> server checks `hasVisa(agentId, scope)` via viem read + signature recovers to `getAgentWallet(agentId)` **or** the linked human -> `200` + payload. Optional `X-PAYMENT: txHash` of a demoUSDT transfer.
- **acceptance:** curl 402 -> 200 with a visa; 403 without / after revoke.
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
| Sat 14–17 | T5 relay on Vercel + PWA onboard | T3 AgentPassport + tests | README/todo/pitch/demo (done), Devfolio apply |
| Sat 17–21 | T6 approve screen + signer on iPhone | T4 deploy HSK, faucet, addresses | addresses -> README, video script |
| Sat 21–00 | T7 MCP server | help T6 (viem tx build) | dry-run demo, record plan-B video |
| Sun 08–11 | e2e polish, error states | T9 gate if time | Devfolio project submission |
| Sun 11–13:30 | freeze, rehearse x3 | freeze | submit, slides |
