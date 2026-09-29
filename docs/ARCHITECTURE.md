# Architecture & API reference

Companion to the README. Everything here is live on HashKey Chain testnet (chainId 133).

## Components

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

- **Agent side** never holds a private key. It has an identity key (in `~/.pap/agent.json`) used only to sign relay requests and gate challenges — it cannot move funds by itself unless the human granted a visa that allows it.
- **Relay** (`web/`, Vercel) is glue: stores pending requests on Vercel Blob (append-only JSON, no database), serves the QR pages, returns the signed result. It holds no keys. `/api/fund` is the only server-side signer and only sends 0.002 HSK testnet gas to new phone wallets.
- **Phone** (`web/`, PWA) holds the human's key. WebAuthn platform passkey; with the PRF extension (iOS 18+) the EVM key is AES-GCM encrypted with a secret only the passkey can derive; without PRF the passkey still requires FaceID before every signature. The phone is the ERC-8004 NFT owner.
- **Chain** is the source of truth: who authorized which agent for what scope, and every payment enforced by `pay()` against limit + expiry.

## On-chain surface (`contracts/`)

| Contract | Calls |
|---|---|
| `IdentityRegistry` (ERC-8004) | `register(agentURI, agentWallet) → agentId` (msg.sender = human = NFT owner) · `agentIdOf(agentWallet)` · `getAgentWallet(agentId)` |
| `AgentPassport` | `grant(agentId, scope, limit, expiry)` · `revoke(agentId, scope)` · `pay(agentId, token, to, amount, ref)` · `record(agentId, scope, amount, ref)` · `canAct(agentId, scope, amount)` · `getGrant(agentId, scope)` · `transferScope(token)` |
| `DemoUSDT` | 6 decimals · `mint(to, amount)` · `faucet()` = 1,000 |
| `ReputationRegistry` | ERC-8004 `giveFeedback` / `getSummary` |
| `PassportRegistry` + `Groth16Verifier` | ZK membership (iteration 3): `publishRoot`, `verifyPassport` |

Scope for ERC-20 transfers = `keccak256(abi.encodePacked("transfer:", token))` (`transferScope(token)`).

### What the phone signs

**Onboarding (`/pair/:id`, 4 txs):**
1. `IdentityRegistry.register(agentURI, agentWallet)` — `agentURI` = `https://pap.devcristobalvc.com/api/agents/<addr>/card`, an ERC-8004 registration file
2. `DemoUSDT.faucet()`
3. `DemoUSDT.approve(AgentPassport, max)`
4. `AgentPassport.grant(agentId, transferScope(demoUSDT), limit, expiry)`

**Payment (`/approve/:id`, 1 tx):** `AgentPassport.pay(agentId, token, to, amount, ref = keccak("pap:req:" + requestId))`. The contract checks the grant (scope, limit, expiry), moves the tokens, records usage and emits `Paid`. Over the limit → `LimitExceeded()`.

**Autonomous mode:** once a grant exists, the agent key itself can call `pay()` inside the visa — the human is not asked. Same limit and expiry apply. See `contracts/README.md` for the live run and `cast` recipes.

## Relay API (`web/src/app/api`)

| Endpoint | Purpose |
|---|---|
| `POST /api/pair` `{agentAddress, agentName, sig}` → `{pairId, url}` · `GET /api/pair/:id` → `{status, ownerAddress?, agentId?, txHash?}` · `POST /api/pair/:id/approve` | Onboarding |
| `POST /api/requests` `{agentAddress, action:{type:"transfer", token, to, amount, memo}, sig}` → `{requestId, url}` · `GET /api/requests/:id` → `{status: pending\|approved\|rejected\|expired, txHash?}` · `POST /api/requests/:id/resolve` | One action, one approval |
| `GET /api/gate/oracle` | x402-shaped visa gate — see `GATE.md` |
| `GET /api/agents/:address` · `GET /api/agents/:address/card` | Agent record, ERC-8004 registration file |
| `POST /api/fund` · `GET /api/health` | Testnet gas sponsor, health + addresses |

Pages: `/` (landing) · `/wallet` (phone app: wallet + pending requests, **Your agents** with each on-chain visa — spent / limit bar, expiry — and **Passport stamps** = real `Paid` events read from HSK with amount, recipient, tx and executor *you* / *agent*) · `/pair/:id`, `/approve/:id` (phone) · `/show/pair/:id`, `/show/request/:id` (big QR for the laptop screen; the MCP opens them automatically).

## MCP server (`mcp/`)

Standalone bundle `mcp/dist/pap.mjs` (esbuild, committed, no `node_modules` needed). `.mcp.json` at the repo root registers it in Claude Code. For other MCP clients (Cursor, Claude Desktop): `command: node`, `args: ["<repo>/mcp/dist/pap.mjs"]`, `env: { PAP_RELAY_URL: "https://pap.devcristobalvc.com" }`.

| Tool | What it does |
|---|---|
| `pap_status()` | Agent identity, pairing state, relay health |
| `pap_connect({name?})` | Onboarding: creates a pair request, shows QR (terminal + browser), waits for the phone |
| `pap_transfer({to, amount, memo?})` | Payment request; `to` = address or contact name; waits up to 5 min; returns `txHash` + explorer link |
| `pap_call_gate({url?})` | x402-style handshake against a gated service: 402 → sign challenge with the agent identity → 200. No human involved; works because the visa is active on-chain |
| `pap_wait({kind, id})` | Resume waiting on a pair/request |
| `pap_contact_add({name, address})` | Local address book |
| `pap_secret({name, reason, deliver?})` | Read a sealed secret after the human approves; default writes `~/.pap/secrets/<name>` (0600) and returns the path |
| `pap_secrets_list()` | Sealed secrets for this agent (never values) |

Rebuild only if you change `mcp/src`: `cd mcp && npm i && npm run build`.

## Sealed secrets (double signature)

An API key the human hands to their agent opens only with **the agent's signature + the human's Face ID**. The relay stores ciphertext, the phone never sees the plaintext, and every read is a stamp on HSK Chain.

```
 LAPTOP (human)                 RELAY (ciphertext only)            PHONE (owner key)               AGENT (identity key)
 pap seal openai ─ value ─┐
   ECIES(agent, {name,agent,secret})  = inner
   ECIES(owner, {name,agent,inner})   = blob
   sign EIP-712 SealRequest ──────────▶ pending seal ─── push/QR ──▶ Face ID
                                                                    grant(agentId, secret:openai, maxReads, expiry)
                                        active  ◀──── resolve ────
                                                                                                     pap_secret(name, reason)
                                        reveal request ◀──────────── EIP-712 RevealRequest {agent,name,reason,nonce,expiry}
                                        ─── push/QR ──▶ shows reason, reads used
                                                        Face ID → peel owner layer → inner
                                                        record(agentId, secret:openai, 1, ref)  (reverts if limit/expiry)
                                                        sign EIP-712 RevealApproval {…, resultHash}
                                        inner ◀─────── resolve
                                        inner ───────────────────────────────────────────────────▶ open with identity key
                                                                                                    → ~/.pap/secrets/openai (0600)
```

| Piece | Where |
|---|---|
| Layered ECIES (secp256k1 ECDH → HKDF-SHA256 → AES-256-GCM, agent + name as additional data), EIP-712 types, scopes | `mcp/src/pap-core.ts` (copied to `web/src/lib/pap-core.ts` by `scripts/sync-core.mjs`) |
| Relay | `POST/GET /api/secrets`, `GET/DELETE /api/secrets/:agent/:name`, `POST /api/requests` (`type: "reveal"`), `POST /api/requests/:id/resolve` (`result`, `approvalSig`), `POST /api/agents/:address/keys` |
| On-chain visa | `AgentPassport` unchanged: scope `keccak256("secret:" + name)`, `limit` = max reads, one `record()` per read |
| Phone | `/approve/:id` (reveal + seal cards), `/wallet` → Vault (revoke / rotate), `/vault/new` (seal from the browser) |
| Agent side | MCP `pap_secret`, `pap_secrets_list`; CLI `pap seal`, `pap secret get|exec|list`; `pap rpc` → `eth_decrypt("pap:secret:<name>")` |

Why this layer order: the phone only removes *its* layer and passes the still-encrypted inner blob on, so the plaintext exists only on the laptop that sealed it and on the agent that asked for it. Binding agent + name as AES-GCM additional data means a (public) blob can't be replayed as another agent's or another secret's.

Two ways to seal: signed by the **agent key** (`pap seal` on the laptop) → pending until the phone grants the visa; signed by the **owner** (`/vault/new`, visa granted in the same flow) → active at once.

## JSON-RPC

- `POST /api/rpc` — JSON-RPC 2.0 `pap_*` namespace over the relay (any language, no MCP).
- `pap rpc` — local Ethereum JSON-RPC (EIP-1193) so `cast`, viem, ethers and web3.py work without a private key.

Both in [`RPC.md`](RPC.md).

## Notifications

Web Push (`public/sw.js`, `POST /api/push/subscribe`, `lib/push.ts`) tells the phone about new requests; the QR stays as fallback. Needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` on the relay (`npx web-push generate-vapid-keys`). Payloads carry agent name + action type only.

## Claude Code plugin

`plugin/` (built by `scripts/sync-plugin.mjs`) bundles the MCP server, the CLI and the `.claude/skills/pap-*` skills; `.claude-plugin/marketplace.json` publishes it: `/plugin marketplace add DevCristobalvc/ethereum-builders-tour-cali` → `/plugin install pap@pap`. Agents without skills: [`AGENTS.md`](AGENTS.md).

## Scripts

| Script | Purpose |
|---|---|
| `web/scripts/phone-sim.mjs` | Approves requests like a phone would (test wallet) — CI / demo plan B |
| `web/scripts/gate-test.mjs [baseUrl] [agentId]` | Exercises the gate handshake |
| `web/scripts/sync-contracts.mjs` | Copies ABIs + addresses from `deployments/` into `web/src/generated/` |
| `mcp/scripts/e2e.mjs` | Full flow with the bundle: pair → pay ok → `LimitExceeded` → gate ACCESS GRANTED |
| `mcp/scripts/secrets-relay-test.ts` · `secrets-e2e.mjs` | Sealed secrets: relay checks (27) · MCP + CLI with the real bundles (11) |
| `mcp/scripts/rpc-test.ts` · `rpc-signer-test.mjs` | `/api/rpc` conformance (18) · `pap rpc` with viem, fake HSK node, headless phone (20) |
| `mcp/scripts/push-test.ts` | Web Push through a fake HTTPS push service, RFC 8291 decryption (10) |
| `npm test` in `mcp/` | `pap-core` unit tests (10) |
| `contracts/script/Deploy.s.sol`, `Seed.s.sol`, `AgentPay.s.sol` | Deploy, seed, autonomous-agent demo |

## Security notes (honest version)

- The passkey does **not** sign on-chain (P-256 ≠ secp256k1). It protects the EVM key in the device. Roadmap: RIP-7212 precompile + account abstraction so the passkey is the on-chain signer.
- The relay is trusted for *liveness* only, never for *authorization*: it cannot sign, and every permission check happens in the contract.
- Prompt injection on the agent can at most *ask*; the phone shows the request in plain language, and the contract caps the damage at the grant's limit.
- Sealed secrets protect the **delivery**, not the **use**: once released, the agent has the value. See `SECURITY.md` → Sealed secrets.
- Sybil: the guarantee is "a responsible human with bounded permissions", not "one human = one agent". Proof-of-personhood can be required at `register` (World ID, ZK passports) — iteration 3.
