# PAP Gate — the border (iteration 2)

A service that lets an agent through **only if it holds a valid visa on-chain**. Shaped like
[x402](https://x402.org): the first request gets a `402` describing what is required, the agent
satisfies it and retries. Instead of a payment, the requirement is *"prove you are an agent whose
human gave you an active visa"*.

Endpoint: `GET /api/gate/oracle` (`web/src/app/api/gate/oracle/route.ts`).
Test: `node web/scripts/gate-test.mjs [baseUrl] [agentId]`.

## Flow

```
Agent                                   Gate                              HashKey Chain
  │  GET /api/gate/oracle                 │                                    │
  │──────────────────────────────────────▶│                                    │
  │  402 Payment Required                 │                                    │
  │  WWW-Authenticate: PAP-Visa           │                                    │
  │  { accepts:[{ scheme:"pap-visa",      │                                    │
  │     network:"eip155:133", passport,   │                                    │
  │     token, scope:"transfer",          │                                    │
  │     challenge, expiresIn:300 }] }     │                                    │
  │◀──────────────────────────────────────│                                    │
  │                                       │                                    │
  │  sig = personal_sign(                 │                                    │
  │    "PAP:gate:" + canonical JSON       │                                    │
  │    {agentAddress, agentId, challenge})│                                    │
  │                                       │                                    │
  │  GET /api/gate/oracle                 │                                    │
  │  X-PAP-VISA: base64({agentAddress,    │                                    │
  │     agentId, challenge, sig})         │                                    │
  │──────────────────────────────────────▶│ 1. challenge HMAC ok & < 5 min     │
  │                                       │ 2. sig recovers agentAddress       │
  │                                       │ 3. IdentityRegistry                │
  │                                       │    .getAgentWallet(agentId)        │
  │                                       │───────────────────────────────────▶│
  │                                       │    == agentAddress ?               │
  │                                       │ 4. AgentPassport.canAct(agentId,   │
  │                                       │    transferScope(demoUSDT), 0)     │
  │                                       │───────────────────────────────────▶│
  │  200 { ok, data:{price,value,ts},     │    == true ?                       │
  │        agentId }                      │                                    │
  │◀──────────────────────────────────────│                                    │
```

Any check failing → `403 { ok:false, error }` (`bad challenge`, `bad signature`,
`key is not the agent's identity key`, `no valid visa (inactive, expired or exhausted)`).
An expired challenge → a fresh `402`, so the agent just restarts the handshake.

## Headers

| Direction | Header | Value |
|---|---|---|
| Gate → agent | `WWW-Authenticate` | `PAP-Visa` |
| Gate → agent | body `accepts[0]` | `scheme`, `network` (CAIP-2), `passport`, `identity`, `token`, `scope`, `challenge`, `expiresIn`, `header`, `sign` |
| Agent → gate | `X-PAP-VISA` | `base64(JSON { agentAddress, agentId, challenge, sig })` |

Signature format is the same as the rest of PAP (`web/src/lib/sig.ts`):
`personal_sign("PAP:gate:" + JSON.stringify(payload with keys sorted recursively))`.

## Challenge (stateless)

`challenge = <hexTimestamp>.<random>.<hmac>` with `hmac = HMAC-SHA256(GATE_SECRET, hexTimestamp.random)[:32]`.
The gate keeps no nonce store: it recomputes the HMAC and checks the timestamp is < 5 min old.
`GATE_SECRET` defaults to `dev`; set it in production. Replay within the 5-minute window is
possible by design for a read-only oracle; for side-effecting resources add a used-nonce set
(or move to `AgentPassport.record()` and let the chain be the nonce store).

## Why "x402-shaped"

x402 standardised *"402 + machine-readable requirements → client satisfies → retry"* for agent
payments. PAP reuses the exact shape (`accepts[]`, `scheme`, `network`, retry with a header) but
swaps the requirement: not *"pay me"* but *"show me your human's authorisation"*. Both are things
an autonomous agent can satisfy without a person in the loop, and both are verifiable on-chain.

- `scheme: "pap-visa"` sits next to x402's `"exact"`; a gate could accept both
  (`accepts: [{scheme:"exact", ...}, {scheme:"pap-visa", ...}]`).
- `network: "eip155:133"` uses the same CAIP-2 id x402 uses.
- The visa is *not* a bearer token: the gate resolves `agentId → identity key` on-chain
  (ERC-8004 `IdentityRegistry`) and checks the grant in `AgentPassport` at request time, so
  revoking or exhausting the visa cuts access immediately.

## Try it

```bash
# needs contracts/.env AGENT_PRIVATE_KEY (agent #6) — or AGENT_PRIVATE_KEY / AGENT_ID env vars
cd web && npm run dev
node scripts/gate-test.mjs http://localhost:3000 6
node scripts/gate-test.mjs https://pap.devcristobalvc.com 6
```

Expected: `[1] 402 → 200`, `[2] random key → 403`, `[3] tampered challenge → 403`, `PASS`.

Manual:

```bash
curl -i http://localhost:3000/api/gate/oracle            # 402 + accepts[]
curl -i -H "X-PAP-VISA: $(echo -n '{...}' | base64)" http://localhost:3000/api/gate/oracle
```
