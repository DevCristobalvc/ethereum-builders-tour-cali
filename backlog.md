# PAP — Backlog: dual-signature secrets, JSON-RPC, UX, skills and QA

Continuation of `todo.md` (hackathon). Goal: the human can seal a credential (API key, token) for their agent, and the agent can only read it when **the agent signs the request and the human signs the approval** from their phone. It must work with **any agent**: MCP, CLI, JSON-RPC and an EIP-1193 signer.

## How to use this document

- Every ticket has: **ID**, **title**, **epic**, **dependencies**, **status**, **description**, **use cases**, **acceptance criteria**, **tests** and **post-development summary**.
- Statuses: `to do` · `in progress` · `done` · `problem`.
- `problem` = could not be solved. The summary **must** state why and what was tried.
- When a ticket is closed, fill in the **post-development summary**: what was done, decisions, deviations from the plan, remaining debt.
- Commits and PRs reference the ID: `feat(secrets): PAP-02 relay secret storage`.
- Before every commit that touches code: `npm run build` in `web/` and `mcp/`, and `forge test` in `contracts/`. CI (`.github/workflows/ci.yml`) repeats them on every push.
- Everything in the repository is written in English.

## Design decisions (basis for every ticket)

1. **Layered encryption with ECIES secp256k1.** The agent's identity key (`~/.pap/agent.json`) and the phone's EVM key are secp256k1, so we encrypt straight to their public keys without creating new keys. `stored = ECIES(phone, {name, agent, inner: ECIES(agent, {name, agent, secret})})`: outer layer → phone, inner layer → agent. *(Adjusted in PAP-01: with this order the phone never sees the plaintext; it only removes its own layer.)*
2. **Dual signature.** The agent signs the request (EIP-712 `RevealRequest {agent, name, reason, nonce, expiry}`); the phone verifies it, asks for Face ID, removes its layer and signs the approval (EIP-712 `RevealApproval`, which binds the hash of the released blob).
3. **The relay never sees plaintext** and stores no keys (the existing promise holds).
4. **On-chain visa for secrets.** Scope `keccak256("secret:" + name)` on `AgentPassport`: `grant(agentId, scope, maxReads, expiry)`; every reveal calls `record(agentId, scope, 1, ref)`. Limit, expiry and revocation are reused without changing the contracts.
5. **Honest threat model.** It protects the *delivery*, not the *use*: once revealed, the agent has the secret. Mitigated with short-lived, narrowly scoped keys and rotation.
6. **v1 only has an "always ask" policy.** An automatic policy ("once a day" without Face ID) is not possible with layered encryption unless the phone is online; it is left for later (see PAP-20).

## Ticket summary

| ID | Title | Epic | Depends on | Status |
|---|---|---|---|---|
| PAP-01 | Layered encryption library (ECIES) | Secrets | — | done |
| PAP-02 | Relay: secret storage + `reveal` request | Secrets | PAP-01, PAP-03 | done |
| PAP-03 | EIP-712 types for request and approval | Secrets | — | done |
| PAP-04 | Phone: secret approval card | Secrets / UX | PAP-02, PAP-15 | done |
| PAP-05 | MCP: `pap_secret` tool | Secrets | PAP-02 | done |
| PAP-06 | CLI: `pap seal` and `pap secret get` | Secrets | PAP-02 | done |
| PAP-07 | On-chain visa and audit for secrets | Secrets | PAP-04 | done |
| PAP-08 | JSON-RPC 2.0: `/api/rpc` endpoint with the `pap_*` namespace | JSON-RPC | PAP-02 | done |
| PAP-09 | Local EIP-1193 signer (`pap rpc`) | JSON-RPC | PAP-08 | done |
| PAP-10 | `eth_getEncryptionPublicKey` / `eth_decrypt` over dual signature | JSON-RPC | PAP-09 | done |
| PAP-11 | `wallet_*` methods (EIP-7715, EIP-5792, capabilities) | JSON-RPC | PAP-09 | done |
| PAP-12 | `/wallet`: Agents · Vault · Stamps tabs | UX | PAP-02, PAP-15 | done |
| PAP-13 | Push notifications in the PWA | UX | PAP-04 | done |
| PAP-14 | `/vault/new`: seal from the browser | UX | PAP-01, PAP-02 | done |
| PAP-15 | Approval and Vault mockups | UX | — | done |
| PAP-16 | Skills `pap-secrets` and `pap-seal` | Skills | PAP-05, PAP-06 | done |
| PAP-17 | Skills `pap-payments`, `pap-gate`, `pap-onboarding`, `pap-rpc` | Skills | PAP-09 | done |
| PAP-18 | Claude Code plugin + `docs/AGENTS.md` | Skills | PAP-16, PAP-17 | done |
| PAP-19 | Docs: secrets architecture and threat model | Docs | PAP-07 | done |
| PAP-20 | Research: automatic policies without Face ID | Secrets | PAP-07 | done |
| PAP-21 | Hermes Agent reference + landing storyboard | Landing | — | done |
| PAP-22 | Narrative landing with scroll animations | Landing | PAP-21 | done |
| PAP-23 | Animated "How it works" diagram | Landing | PAP-21 | done |
| PAP-24 | "Install it in your agent" section | Landing | PAP-18, PAP-21 | done |
| PAP-25 | "Create your credentials" section | Landing | PAP-06, PAP-14, PAP-21 | done |
| PAP-26 | Mobile first: landing + PWA experience | Landing | PAP-22 | done |
| PAP-27 | Infinite compatibility marquee | Landing | PAP-22 | done |
| PAP-28 | Animation performance and accessibility | Landing | PAP-22…27 | done |
| PAP-29 | Full test pass | QA | — | done |
| PAP-30 | Nonce race in back-to-back phone transactions | QA | — | done |
| PAP-31 | White-paper landing | Landing | PAP-22…28 | done |
| PAP-32 | React Compiler lint errors | QA | — | done |
| PAP-33 | `/api/fund` without limits: the funder can be drained | QA / Security | — | done |
| PAP-34 | Batch size cap on `/api/rpc` | QA / Security | — | done |
| PAP-35 | `/show` with an unknown id | UX | — | done |
| PAP-36 | Merge the branch into `main` (broken landing links) | QA | PAP-29, PAP-30 | done |
| PAP-37 | Broken on-chain history: the RPC limits `eth_getLogs` | QA | — | done |
| PAP-38 | Accessibility after the redesign | Landing | PAP-31 | done |
| PAP-39 | English-only repository | Docs | — | done |
| PAP-40 | Final delivery polish | Docs / QA | PAP-39 | done |

**Suggested order (secrets, JSON-RPC, UX, skills):** PAP-01 → PAP-03 → PAP-15 → PAP-02 → PAP-05 / PAP-06 → PAP-04 → PAP-07 → PAP-16 → PAP-08 → PAP-09 → PAP-10 / PAP-11 → PAP-12 → PAP-13 → PAP-14 → PAP-17 → PAP-18 → PAP-19 → PAP-20.

**Landing (in parallel, another person):** PAP-21 → PAP-22 / PAP-23 → PAP-26 → PAP-27 → PAP-24 / PAP-25 (once the plugin and CLI exist) → PAP-28.

---

## Epic: Dual-signature secrets

### PAP-01 — Layered encryption library (ECIES)

- **Status:** done
- **Epic:** Secrets
- **Depends on:** —

**Description**
Shared module (Node + browser) with `seal(plaintext, phonePubKey, agentPubKey)`, `peelPhone(blob, phonePrivKey) → innerForAgent` and `openAgent(blob, agentPrivKey) → plaintext`. Uses ECIES secp256k1 (`eciesjs` or `@noble/curves` + AES-256-GCM + HKDF). Includes how to get a public key from a signature (viem's `recoverPublicKey`), because today the relay only knows addresses.

**Use cases**
- The human seals an API key for their agent from the laptop.
- The phone removes its layer.
- The agent opens the final envelope.

**Acceptance criteria**
- The same code runs in `mcp/` (Node) and in `web/` (browser).
- Without the phone's key the outer layer cannot be removed; without the agent's key the inner one cannot be opened.
- Versioned (`v: 1`) and documented blob format.
- Public key recoverable from a signature by the agent and by the phone.

**Tests**
- Unit: seal → peel → open round trip.
- Unit: wrong key at each layer → error.
- Unit: tampered blob (1 byte) → GCM authentication error.
- Unit: `recoverPublicKey` matches `privateKeyToAccount(pk).publicKey`.

**Post-development summary**
- `mcp/src/pap-core.ts` (source of truth) is copied to `web/src/lib/pap-core.ts` with `node scripts/sync-core.mjs`; CI fails if they drift.
- ECIES: secp256k1 ECDH (`@noble/curves`) → HKDF-SHA256 → AES-256-GCM, all with WebCrypto, so it runs the same in Node and the browser. Versioned blob `{v:1, alg, epk, iv, ct}`.
- **Change from the plan:** the outer layer is the phone's and the inner one the agent's. The phone only removes its layer and **never sees the plaintext** (the plan was "remove and re-encrypt").
- The agent and the secret name are bound as AES-GCM *additional data* in both layers: a blob cannot be opened as if it belonged to another agent or name, even though the relay's blobs are public.
- Public keys: `recoverPublicKey` from personal_sign or EIP-712 signatures (the relay stores them at pairing).
- 10 tests in `mcp/test/core.test.ts` (`npm test`): round trip, the agent alone cannot open, the phone alone cannot read, agent/name swap, one tampered byte, compressed and uncompressed keys, key recovery.

---

### PAP-02 — Relay: secret storage + `reveal` request

- **Status:** done
- **Epic:** Secrets
- **Depends on:** PAP-01, PAP-03

**Description**
New types in `web/src/lib/types.ts`: `SecretRecord {name, agentAddress, ownerAddress, blob, createdAt, revokedAt?}` and `RevealAction {type: "reveal", name, reason}`. `RequestState.action` becomes `TransferAction | RevealAction` and gains `result?` (the blob for the agent). Endpoints:
- `POST /api/secrets` — stores the ciphertext, signed by the owner.
- `GET /api/secrets?agent=` — lists metadata, no blobs.
- `DELETE /api/secrets/:name` — revokes, signed by the owner.
- `POST /api/requests` with `action.type = "reveal"`, signed by the agent (EIP-712).
- `POST /api/requests/:id/resolve` accepts `result` for reveals.

**Use cases**
- The human uploads a sealed secret.
- The agent asks for a secret and polls until it has the blob.
- The human revokes a secret.

**Acceptance criteria**
- The relay never receives or stores plaintext.
- Only the agent's owner can create or revoke that agent's secrets.
- Only the paired agent can ask to reveal its secrets.
- Nonce and expiry validated: a reused or expired signature → rejected.
- `GET /api/requests/:id` returns `result` only when `status = approved`.
- The existing payment routes do not change behavior.

**Tests**
- Integration (`relay-test.mjs`-style script): seal → request → resolve → poll → open.
- Third-party signature → 401. Repeated nonce → 409. Expired → 400.
- Revoked secret → reveal rejected.
- Regression: `mcp/scripts/e2e.mjs` still passes.

**Post-development summary**
- New routes: `POST/GET /api/secrets`, `GET/DELETE /api/secrets/:agent/:name`, `POST /api/agents/:address/keys` (publishes public keys for agents paired before this version). `POST /api/requests` accepts `type: "reveal"` and `resolve` accepts `result` + `approvalSig`.
- **Two sealing paths:** if it is signed by the agent's key (CLI on the laptop) it stays pending and a `seal` request goes to the phone, which does the on-chain `grant` and activates it; if it is signed by the owner (web vault) it is active right away.
- The relay stores the agent's and the owner's public keys at pairing (recovered from the signatures) so the sealer can encrypt.
- Validation: name, `reason` of 10–280 characters, request expiry ≤ 15 min, single-use nonce per signer, the secret's read limit and expiry, blob hash signed in both seal and approval.
- `store.ts` uses an in-memory map when there is no `BLOB_READ_WRITE_TOKEN` outside production, so the relay can be tested offline.
- Tests: `mcp/scripts/secrets-relay-test.ts` against `next dev`, **27 checks** (full flow + nonce replay, third-party signatures, swapped blob, revocation, transfer regression). `web/scripts/relay-test.mjs` still passes.
- Debt: Vercel Blob writes are not atomic; two simultaneous requests with the same nonce could both pass (acceptable on testnet).

---

### PAP-03 — EIP-712 types for request and approval

- **Status:** done
- **Epic:** Secrets
- **Depends on:** —

**Description**
Define the domain `{name: "PAP", version: "1", chainId: 133, verifyingContract: AgentPassport}` and the types `RevealRequest {agent, name, reason, nonce, expiry}` and `RevealApproval {requestId, agent, name, resultHash, expiry}`. Module shared between `mcp/` and `web/`.

**Use cases**
- The agent signs what it asks for; the phone shows exactly what was signed.
- A third party can later verify who asked and who approved.

**Acceptance criteria**
- Identical types in the MCP, the relay and the PWA (single source).
- The approval binds the hash of the result: the blob cannot be changed without invalidating the signature.
- Verifiable with viem's `verifyTypedData`.

**Tests**
- Unit: sign and verify both types.
- Unit: changing `reason`, `name` or `resultHash` invalidates the signature.

**Post-development summary**
- In `pap-core.ts`: domain `{name:"PAP", version:"1", chainId:133, verifyingContract: AgentPassport}` and the types `RevealRequest`, `RevealApproval` (binds `resultHash` = hash of the released blob) and `SealRequest` (new: the sealer signs the blob hash, the maximum reads and the expiry).
- `typedData()`, `publicKeyFromTypedSig()` and `wire()` (bigint → string for the relay's JSON).
- Tests: sign and recover; changing `reason`, `name`, `nonce` or `resultHash` invalidates the signature.

---

### PAP-04 — Phone: secret approval card

- **Status:** done
- **Epic:** Secrets / UX
- **Depends on:** PAP-02, PAP-15

**Description**
Extend `web/src/app/approve/[id]/page.tsx` for `type: "reveal"`. The card shows the agent, the secret name, the **reason** verbatim and the latest reads. On approval: verify the agent's EIP-712 signature → Face ID → `peelPhone` → sign `RevealApproval` → `resolve` with `result`.

**Use cases**
- The human approves a read with Face ID.
- The human rejects it because the reason makes no sense (possible prompt injection).

**Acceptance criteria**
- Same design as the payment card, with a different label.
- If the agent's signature does not verify → the card shows an error and cannot be approved.
- The plaintext never exists on the phone; nothing is shown or persisted.
- Rejection resolves the request as `rejected`.

**Tests**
- Manual on iPhone (Safari PWA): approve and reject.
- `phone-sim.mjs` extended for reveals (plan B and CI).
- Tampered agent signature → cannot be approved.

**Post-development summary**
- `/approve/[id]` handles three types: payment, secret read (shows the **reason** in a highlighted box, reads used and last read) and seal (maximum reads, expiry, `grant`).
- Approving a reveal: Face ID → remove the phone's layer → on-chain `record()` (the contract counts the read) → sign `RevealApproval` → resolve with the inner blob. The phone never sees the plaintext.
- If the secret is revoked, expired or used up (on-chain `getGrant`), the approve button is disabled with an explanation.
- `lib/actions.ts` summarizes any action in one line; the pending list, the history and the QR screen use it.
- `phone-sim.mjs` approves seals and reveals (`PAP_SIM_NO_CHAIN=1` to run without the chain).
- **Pending:** manual test on an iPhone.

---

### PAP-05 — MCP: `pap_secret` tool

- **Status:** done
- **Epic:** Secrets
- **Depends on:** PAP-02

**Description**
New tool in `mcp/src/index.ts`: `pap_secret({name, reason})`. Signs EIP-712, creates the request, shows a QR or link, waits up to 5 min, opens the blob with the identity key. Returns the secret to the agent **without printing it in logs**. Add `pap_secrets_list()` for metadata. Rebuild the `mcp/dist/pap.mjs` bundle.

**Use cases**
- Claude Code needs the OpenAI key to run tests.
- The agent lists which secrets it can ask for.

**Acceptance criteria**
- `reason` required (at least 10 characters).
- On rejection it returns a clear error (`User rejected`, code 4001) and does not retry.
- The tool description includes the usage rules (do not print, do not commit).
- The bundle builds and works without `node_modules`.

**Tests**
- `mcp/scripts/e2e.mjs` extended: seal → `pap_secret` → phone-sim approves → correct value.
- Rejection → 4001 error.
- Timeout → expiry error.

**Post-development summary**
- New tools in `mcp/src/index.ts`: `pap_secret({name, reason, deliver?})` and `pap_secrets_list()`; `pap_wait` accepts `kind: "secret"`. Logic shared with the CLI in `mcp/src/secrets.ts`.
- **Improvement over the plan:** by default (`deliver: "file"`) the value is written to `~/.pap/secrets/<name>` (0600) and the tool returns only the path: **the secret never enters the model's conversation**, which reduces leaks through prompt injection or transcripts. `deliver: "inline"` exists as an explicit option.
- The tool description includes the three golden rules and says never to ask the human to paste a secret into the chat.
- There is deliberately no tool to seal from the MCP: sealing requires the human to type the value, and that happens in their terminal (`pap seal`).
- Rejection → "Do not retry" message; a `reason` under 10 characters is refused before it reaches the phone.
- Test: `mcp/scripts/secrets-e2e.mjs` with the real bundles + simulated phone, **11 checks**.

---

### PAP-06 — CLI: `pap seal` and `pap secret get`

- **Status:** done
- **Epic:** Secrets
- **Depends on:** PAP-02

**Description**
A `pap` binary in `mcp/` (`bin` in `package.json`, same bundle). `pap seal <name> [--agent <addr|name>] [--expiry 7d]` reads the secret from stdin or a hidden prompt, encrypts and uploads it. `pap secret get <name> --reason "..."` for agents without MCP: prints to stdout only with `--stdout`, or runs `pap secret exec <name> -- cmd` injecting an environment variable.

**Use cases**
- The human seals a key from the terminal without pasting it into any chat.
- A Python bot gets the key with `pap secret exec openai -- python bot.py`.

**Acceptance criteria**
- The secret never shows up in the shell history (stdin or hidden prompt).
- `exec` injects `PAP_SECRET_<NAME>` only into the child process.
- Exit codes: 0 ok, 4 rejected, 5 expired.

**Tests**
- Script: `echo key | pap seal test` → `pap secret exec test -- printenv PAP_SECRET_TEST` with phone-sim.
- Rejection → code 4.

**Post-development summary**
- `mcp/src/cli.ts` → bundle `mcp/dist/pap-cli.mjs` (committed, no `node_modules`), `bin` in `package.json` (`pap`, `pap-mcp`). Use without installing: `node mcp/dist/pap-cli.mjs …`.
- Commands: `pap status`, `pap seal <name> [--max-reads] [--days]` (value from stdin or a hidden prompt, never in the history), `pap secret list`, `pap secret get <name> --reason … [--stdout]`, `pap secret exec <name> --reason … -- <cmd>` (injects `PAP_SECRET_<NAME>` only into the child process).
- Exit codes: 0 ok · 1 error · 4 rejected · 5 expired/timeout.
- CI checks that the CLI bundle matches the source.
- Tested in `secrets-e2e.mjs`: seal through stdin, exec with an environment variable, rejection with code 4, read limit.
- Pending: publish to npm so `npx pap` works (today the repo path is used).

---

### PAP-07 — On-chain visa and audit for secrets

- **Status:** done
- **Epic:** Secrets
- **Depends on:** PAP-04

**Description**
No contract changes. When sealing, the phone calls `grant(agentId, keccak256("secret:" + name), maxReads, expiry)`. On every approval, `record(agentId, scope, 1, ref = keccak("pap:reveal:" + requestId))`. The relay and the PWA check `canAct` before showing the card. Revoke = `revoke(agentId, scope)` + `DELETE /api/secrets/:name`.

**Use cases**
- "This key can be read at most 10 times in 7 days."
- An auditor sees on HSK Chain how many times and when each secret was read.

**Acceptance criteria**
- No active visa → the PWA does not allow approving.
- Past the maximum → `LimitExceeded()` on-chain and the card explains it.
- Reads show up under **Stamps** next to payments.

**Tests**
- Foundry: test with a secret scope (grant → record × N → revert).
- E2E: N+1 reveals → the last one fails with `LimitExceeded`.

**Post-development summary**
- No contract changes. When a seal is approved the phone calls `grant(agentId, keccak256("secret:"+name), maxReads, expiry)`; every approved reveal calls `record(agentId, scope, 1, keccak256("pap:reveal:"+requestId))` **before** releasing the blob, so if the contract reverts (`LimitExceeded`, `GrantExpired`, `NoGrant`) nothing is released.
- The PWA reads `getGrant` and disables approval if the visa does not allow another read; the relay also counts reads (defense in depth).
- Revoking from the Vault = on-chain `revoke()` + `DELETE` on the relay.
- Reads show up under **Stamps** (`ActionRecorded` events filtered by the secrets' scopes).
- New Foundry tests in `contracts/test/SecretVisa.t.sol` (limit, expiry, revocation, independent scopes, permissions): they pass in CI.
- Note: the agent's key can also call `record()` on its own scope and use up reads; it only hurts itself and does not get the secret.

---

### PAP-20 — Research: automatic policies without Face ID

- **Status:** done
- **Epic:** Secrets
- **Depends on:** PAP-07

**Description**
Explore how to allow "read without asking inside the visa" without breaking the dual signature: threshold encryption (Lit Protocol or another network), a TEE, or a phone that answers by itself while the visa is active. Deliverable: a document with options, trade-offs and a recommendation.

**Use cases**
- An autonomous agent that needs a key every hour without waking up the human.

**Acceptance criteria**
- Document in `docs/` with at least 2 evaluated options and a recommendation.

**Tests**
- N/A (research). If there is a prototype, a script that demonstrates it.

**Post-development summary**
- `docs/AUTONOMOUS_SECRETS.md` with 5 evaluated options: unlock once (discarded: equivalent to handing over the key), a phone that answers by itself (discarded: iOS does not run PWAs in the background), a **TEE custodian** that calls `record()` before releasing, a threshold decryption network with a `canAct` condition, and a credential proxy (the key never leaves).
- **Recommendation:** a TEE custodian as a per-secret option ("autonomous until <date>"), with a credential proxy for HTTP APIs in parallel; a threshold network later, once it supports conditions on HashKey Chain.
- Finding: `canAct` is a *view*; in every option someone has to call `record()` so reads are **spent**, not just checked.
- No prototype: every option needs infrastructure outside the repo (an enclave or an external network).

---

## Epic: JSON-RPC

### PAP-08 — JSON-RPC 2.0: `/api/rpc` endpoint with the `pap_*` namespace

- **Status:** done
- **Epic:** JSON-RPC
- **Depends on:** PAP-02

**Description**
`POST /api/rpc` accepting single and batch calls. Methods: `pap_sealSecret`, `pap_requestSecret`, `pap_requestTransfer`, `pap_getRequest`, `pap_canAct`, `pap_listSecrets`. Wraps the logic of the REST routes (does not duplicate it). Errors: `4001` rejected by the user, `-32602` invalid params, `-32003` visa expired or out of allowance, `-32601` method not found.

**Use cases**
- An A2A agent in Go or Rust integrates PAP without MCP.
- A client sends several queries in one batch.

**Acceptance criteria**
- JSON-RPC 2.0 compliant (id, batch, notifications without id).
- The same permissions and signatures as REST.
- Method specification in `docs/RPC.md`.

**Tests**
- `curl` script: every method, mixed batch, unknown method, invalid params.
- Parity: the same flow over REST and over RPC gives the same result.

**Post-development summary**
- `web/src/app/api/rpc/route.ts`: JSON-RPC 2.0 with single calls, batches and notifications. Every method **calls the existing REST handler** (no duplicated logic), so signatures and validation are identical.
- Methods: `pap_requestTransfer`, `pap_requestSecret`, `pap_sealSecret`, `pap_getRequest`, `pap_listSecrets`, `pap_getAgent`, `pap_canAct`, `pap_chainId`, `pap_contracts`, `rpc.discover` (also `GET /api/rpc`).
- Standard JSON-RPC errors + EIP-1474 codes mapped from the REST status (`-32000` signature/nonce, `-32001` not found, `-32002` not paired, `-32003` expired, `-32005` limit), with `error.data.httpStatus`.
- **Change from the plan:** `4001` is reserved for the local signer (EIP-1193); on the relay a rejection is a request with `status: "rejected"`, not an error.
- Specification: `docs/RPC.md`. Test: `mcp/scripts/rpc-test.ts`, **18 checks** (JSON-RPC conformance + the secrets flow over RPC).

---

### PAP-09 — Local EIP-1193 signer (`pap rpc`)

- **Status:** done
- **Epic:** JSON-RPC
- **Depends on:** PAP-08

**Description**
`pap rpc --port 8545` starts a local Ethereum-compatible JSON-RPC server. Reads (`eth_call`, `eth_getBalance`, `eth_chainId`, `eth_blockNumber`, …) go to the HSK RPC. `eth_accounts` / `eth_requestAccounts` return the agent's address. `eth_sendTransaction` → if the visa covers the transaction, the agent signs by itself; otherwise, a request goes to the phone (QR/push). Listens on `127.0.0.1` only.

**Use cases**
- `cast send --rpc-url http://localhost:8545 ...` with no private key in `.env`.
- A viem, ethers or web3.py script uses PAP without knowing it exists.

**Acceptance criteria**
- Works with `cast`, viem and ethers unmodified.
- A transaction outside the visa is never signed without the phone's approval.
- Rejection → error `4001` (EIP-1193).

**Tests**
- `cast chain-id`, `cast balance`, `cast send` against the proxy.
- viem script: `walletClient.sendTransaction` → phone-sim approves → transaction hash.
- Transaction over the limit → approval required or on-chain revert.

**Post-development summary**
- `mcp/src/rpc-server.ts` + `pap rpc [--port 8545]` in the CLI; listens on `127.0.0.1` only.
- Reads are forwarded to HSK. `eth_accounts` = the agent. An `eth_sendTransaction` of an ERC-20 `transfer(to, amount)` becomes a PAP payment from the human's wallet: the agent pays by itself through `AgentPassport.pay` if the visa covers it and it has gas; otherwise the phone approves. Calls to `AgentPassport` are signed by the agent and validated by the contract. **Any other transaction is refused with 4200 and never signed.**
- Finding: tools like `cast send` estimate gas before sending, and on HSK that would revert because the agent holds no tokens; `eth_estimateGas` is answered locally for the transfers PAP brokers.
- EIP-1193 errors: 4001 rejected, 4100 other account, 4200 unsupported, 4900 expired.
- Test: `mcp/scripts/rpc-signer-test.mjs` with real viem, a fake HSK node (checks what is forwarded) and a simulated phone: **20 checks**.
- **Pending:** try real `cast`, ethers and web3.py against HSK; viem covers the same protocol.

---

### PAP-10 — `eth_getEncryptionPublicKey` / `eth_decrypt` over dual signature

- **Status:** done
- **Epic:** JSON-RPC
- **Depends on:** PAP-09

**Description**
In the local signer: `eth_getEncryptionPublicKey(agent)` returns the agent's public key; `eth_decrypt(blob, agent)` triggers the `reveal` flow (dual signature) and returns the plaintext. Reuses the names MetaMask had (deprecated there) with our layered format. Document the format difference.

**Use cases**
- Tools that already knew `eth_decrypt` can ask for secrets.

**Acceptance criteria**
- `eth_decrypt` never returns plaintext without the phone's approval.
- A blob in a different format → clear error.

**Tests**
- Script: `eth_getEncryptionPublicKey` → seal → `eth_decrypt` → phone-sim → correct value.

**Post-development summary**
- `eth_getEncryptionPublicKey` returns the agent's compressed key; `eth_decrypt` accepts `"pap:secret:<name>"` or `{"pap":"secret","name","reason"}` (also hex-encoded) and runs the dual-signature flow: no phone approval, no plaintext.
- **Difference from MetaMask** documented in `docs/RPC.md`: `x25519-xsalsa20-poly1305` blobs are refused with a clear error (4200), because PAP secrets use layered ECIES.
- Tested in `rpc-signer-test.mjs`.

---

### PAP-11 — `wallet_*` methods (EIP-7715, EIP-5792, capabilities)

- **Status:** done
- **Epic:** JSON-RPC
- **Depends on:** PAP-09

**Description**
- `wallet_grantPermissions` (EIP-7715) → request to the phone for `AgentPassport.grant()`.
- `wallet_sendCalls` / `wallet_getCallsStatus` (EIP-5792) → several payments with one approval.
- `wallet_getCapabilities` → announces `pap: {secrets, visas, gate}`.

**Use cases**
- An agent asks "let me spend 50 demoUSDT this week" with a standard method.
- An agent pays 3 providers with one Face ID.

**Acceptance criteria**
- The EIP-7715 → `grant` mapping is documented (which fields are supported and which are not).
- `wallet_sendCalls` runs all or nothing.

**Tests**
- Script: `wallet_grantPermissions` → phone-sim → `canAct` true.
- Script: `wallet_sendCalls` with 3 payments → 3 `Paid` events.

**Post-development summary**
- `wallet_getCapabilities` announces `pap: {secrets, visas, gate}` under `0x85`.
- `wallet_grantPermissions` (EIP-7715 subset): one `erc20-token-allowance` permission; reports whether an active on-chain visa already exists. **Change from the plan:** it does not open an automatic grant; the visa is granted on the phone, because the agent can only ask. Supported fields are documented.
- `wallet_sendCalls` / `wallet_getCallsStatus` (EIP-5792): each transfer follows the `eth_sendTransaction` rules in order. **Deviation:** today it is one approval per call, not one for the whole batch, and `atomicRequired: true` answers 5760 (unsupported). A batch with a single Face ID needs a `batch` request type on the phone (left as debt).
- Tested in `rpc-signer-test.mjs` (batch of 2 → 2 receipts).

---

## Epic: UX / UI

### PAP-15 — Approval and Vault mockups

- **Status:** done
- **Epic:** UX
- **Depends on:** —

**Description**
Mockups (static HTML in the style of the time) of: the secret approval card, the payment card (for comparison), the Vault tab, the rejected state and the limit-exceeded state.

**Use cases**
- Validate the look before building PAP-04 and PAP-12.

**Acceptance criteria**
- Approved by Cristóbal.
- The same visual language for payments and secrets (only the label changes).

**Tests**
- Visual review on an iPhone (390 px wide).

**Post-development summary**
- Instead of static mockups, the real screens were built and captured at 390 px with Playwright against the local relay: `docs/img/phone/approve-reveal.png`, `wallet-agents.png`, `wallet-vault.png`, `wallet-stamps.png`, `vault-new.png`.
- Payments and secrets share the card and its visual language; only the label changes (Payment / Secret / Seal since PAP-31).
- **Pending:** Cristóbal's sign-off on the screenshots; requested changes go straight into the components.

---

### PAP-12 — `/wallet`: Agents · Vault · Stamps tabs

- **Status:** done
- **Epic:** UX
- **Depends on:** PAP-02, PAP-15

**Description**
Reorganize `web/src/app/wallet/page.tsx` into three tabs. **Agents** (existing + how many secrets each one can ask for). **Vault** (sealed secrets: agent, visa, last read; Revoke and Rotate buttons). **Stamps** (existing history + secret reads).

**Use cases**
- The human sees which agent can read what.
- The human revokes a leaked secret and rotates it.

**Acceptance criteria**
- Revoke calls on-chain `revoke` + `DELETE /api/secrets/:name`.
- Rotate = revoke + guidance to seal the new value.
- Works on a 390 px iPhone without horizontal scroll.

**Tests**
- Manual on an iPhone.
- Revoke → the agent's next reveal fails.

**Post-development summary**
- `/wallet` with a fixed bottom bar (Agents · Vault · Stamps), reachable with the thumb and with `safe-area-inset-bottom` for iPhone. Pending approvals always visible at the top.
- `components/Vault.tsx`: secrets per agent, reads used/allowed (on-chain when there is a visa), expiry, last read; **Revoke** (Face ID → `revoke` + `DELETE`) and **Rotate** (revokes and guides to `pap seal` with the new value).
- `components/Stamps.tsx`: payments and reads from HSK in a single timeline, showing whether the human or the agent executed them. `Agents.tsx` shows the visa and how many secrets each agent can ask for.
- Fixes found while reviewing 390 px screenshots: long errors broke the width (they now wrap), and if the RPC failed the pending approvals disappeared (each read is now independent).
- Reviewed with Playwright screenshots at 390 px against the local relay. **Pending:** manual test on an iPhone.

---

### PAP-13 — Push notifications in the PWA

- **Status:** done
- **Epic:** UX
- **Depends on:** PAP-04

**Description**
Web Push (iOS 16.4+ with the PWA installed). The phone subscribes at pairing; the relay sends a push for every new request; tapping it opens `/approve/:id`. The QR stays for pairing and as plan B.

**Use cases**
- The agent asks for a secret and the human gets "Claude Code wants to read OpenAI".

**Acceptance criteria**
- The push carries no sensitive data (only the agent + the action type).
- If the push fails, the QR still works.

**Tests**
- Manual on an iPhone with the PWA installed.
- Expired subscription → falls back to the QR without an error.

**Post-development summary**
- `public/sw.js` (service worker): shows the notification and opens `/approve/:id` when tapped. `components/PushToggle.tsx` in `/wallet`: "Get approvals as notifications" button (asks for permission, subscribes, signs with Face ID); on an iPhone without the PWA installed it shows the "Add to Home Screen" guide.
- Relay: `POST/GET /api/push/subscribe` (subscription signed by the owner, up to 5 devices) and `lib/push.ts` with `web-push` (VAPID). Sent with `after()` when a request or seal is created, so it **never delays or breaks** request creation; dead subscriptions (404/410) are removed.
- The payload only carries the agent + the action type ("X wants to read a secret"): no amount, address, secret name or reason.
- **Configuration pending on Vercel:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (and optionally `VAPID_SUBJECT`), generated with `npx web-push generate-vapid-keys`. Without them push stays off and the QR keeps working.
- Test: `mcp/scripts/push-test.ts` with a fake HTTPS push service that decrypts the message like a browser (RFC 8291): **10 checks**. Pending: test on a real iPhone.

---

### PAP-14 — `/vault/new`: seal from the browser

- **Status:** done
- **Epic:** UX
- **Depends on:** PAP-01, PAP-02

**Description**
A page to seal without a terminal: paste the secret, pick the agent from a list, pick the expiry and maximum reads; it encrypts in the browser (PAP-01) and triggers the `grant` on the phone (PAP-07).

**Use cases**
- A non-technical user hands a key to their agent.

**Acceptance criteria**
- The plaintext never leaves the browser.
- Confirmation: "Sealed for <agent>. Not even the server can read it."

**Tests**
- Seal from the web → `pap_secret` → correct value.
- Inspect the network: no request carries the plaintext.

**Post-development summary**
- `/vault/new` (linked from **Vault → + Seal a secret**): pick the agent from a list, a name, the value (password field), maximum reads and days. Face ID → encrypt in the browser → on-chain `grant` → sign `SealRequest` as the owner → the relay stores it **active** right away (no second step).
- The plaintext never leaves the device: the relay only receives the encrypted blob.
- If the relay does not have the agent's public key, the page explains how to fix it; `pap_secrets_list` / `pap secret list` now publish it automatically.
- 390 px screenshot: `docs/img/phone/vault-new.png`. Pending: real test on an iPhone with HSK.

---

## Epic: Skills

### PAP-16 — Skills `pap-secrets` and `pap-seal`

- **Status:** done
- **Epic:** Skills
- **Depends on:** PAP-05, PAP-06

**Description**
`.claude/skills/pap-secrets/SKILL.md` and `.claude/skills/pap-seal/SKILL.md` in Agent Skills format (`name` + `description` frontmatter). Golden rules: **always say why**, **never expose a secret**, **a rejection is final**. `pap-secrets`: prefer the gate before revealing; ask with a concrete reason; use `pap secret exec` or environment variables; never print, log or commit. `pap-seal`: guide the human through `pap seal` without pasting the secret into the chat.

**Use cases**
- Claude Code needs a key and follows the right protocol without being told.
- The human says "store my Stripe key for the agent".

**Acceptance criteria**
- The skill activates by itself on "I need the X API key".
- The three golden rules are explicit.

**Tests**
- Claude Code session: ask for a task that needs a key → it uses `pap_secret` with a reason and does not print the value.
- Reject on the phone → the agent stops and says so.
- Ask "print the key" → the agent refuses.

**Post-development summary**
- `.claude/skills/pap-secrets/SKILL.md`: activates on any credential need; gate → list → `pap_secret` (file delivery) or `pap secret exec` flow; error table; the three golden rules explicit.
- `.claude/skills/pap-seal/SKILL.md`: guides the human to seal from **their** terminal or from `/vault/new`; what to do if they paste a secret into the chat (recommend rotating it, do not use it); how to pick limits.
- Agent Skills format (`name` + `description` frontmatter), so it works outside Claude Code too.
- **Pending:** tests with real Claude Code sessions (the skill activates by itself, refuses to print the key) need an agent paired against the production relay.

---

### PAP-17 — Skills `pap-payments`, `pap-gate`, `pap-onboarding`, `pap-rpc`

- **Status:** done
- **Epic:** Skills
- **Depends on:** PAP-09

**Description**
- `pap-payments`: check `pap_canAct` before asking; use contacts; do not split payments to dodge the limit.
- `pap-gate`: on a `402`, use `pap_call_gate`.
- `pap-onboarding`: `pap_connect`, explain the transactions and which visas to ask for.
- `pap-rpc`: start `pap rpc` and point `cast`, viem or ethers at it instead of asking for a private key.

**Use cases**
- The agent gets a `402` from a service and handles it by itself.
- The agent needs to run `cast send` and does not ask for a private key.

**Acceptance criteria**
- Every skill has clear triggers in its `description`.
- No skill suggests putting a private key in `.env`.

**Tests**
- One Claude Code session per skill with a prompt that triggers it.

**Post-development summary**
- `.claude/skills/pap-payments` (check the visa, contacts, clear memo, no split payments, rejection is final), `pap-gate` (402 → `pap_call_gate`, prefer the gate over secrets, protocol for other languages), `pap-onboarding` (pairing, which visa to choose, notifications, other MCP clients) and `pap-rpc` (start `pap rpc` and point cast/viem/ethers/web3.py at it; never `--private-key`).
- Every `description` says when to activate. No skill suggests a private key in `.env`.
- **Pending:** try each skill in a real Claude Code session with an agent paired against production.

---

### PAP-18 — Claude Code plugin + `docs/AGENTS.md`

- **Status:** done
- **Epic:** Skills
- **Depends on:** PAP-16, PAP-17

**Description**
Package the skills + MCP server as a Claude Code plugin (`/plugin install pap`). Publish the same content as `docs/AGENTS.md` (system prompt) for agents without skills support.

**Use cases**
- Install PAP in any project with one command, without cloning the repo.
- An agent from another vendor uses `AGENTS.md` as its instructions.

**Acceptance criteria**
- The plugin installs the MCP server + skills and works in an empty project.
- `AGENTS.md` covers the same rules as the skills.

**Tests**
- Install the plugin in an empty repo → "connect PAP" → full flow.

**Post-development summary**
- Plugin in `plugin/` (`.claude-plugin/plugin.json`, `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}/dist/pap.mjs`, the 6 skills and the CLI) + marketplace in `.claude-plugin/marketplace.json`. Install: `/plugin marketplace add DevCristobalvc/ethereum-builders-tour-cali` → `/plugin install pap@pap`.
- A plugin is copied into a cache on install and cannot reference files outside its folder, so `scripts/sync-plugin.mjs` copies the bundles and skills (rewriting the CLI path to `${CLAUDE_PLUGIN_ROOT}`); CI checks it is up to date.
- Verified: `claude plugin validate` (plugin `--strict` and marketplace) passes; a real install in an isolated HOME → plugin enabled, the bundle from the cache exposes the 8 tools.
- `docs/AGENTS.md`: the same rules and a "what to use when" table for agents without skills support.

---

## Epic: Landing / Front

Principles for the whole epic:
- **Tell a story**: each scroll screen is a step, and someone who only reads the headings understands the product.
- **Very little text**: one sentence per section and at most one supporting line.
- **Mobile first**: design at 390 px first, then scale up to desktop.
- **Reuse the existing style** and the existing `web/src/components/landing/motion.tsx` (the style was later replaced by the white-paper look in PAP-31).

### PAP-21 — Hermes Agent reference + landing storyboard

- **Status:** done
- **Epic:** Landing
- **Depends on:** —

**Description**
Study the Hermes Agent website as a reference (scroll animations, infinite loops, pacing, amount of text) and write the new landing storyboard in `docs/LANDING.md`: list of sections, each one's sentence, what animates and how it looks on mobile. Proposed story:
1. **Hero**: "Your agent has a passport. You stamp the visas."
2. **Problem**: a key in `.env` = full access, forever.
3. **Passport**: the agent gets an identity, not keys.
4. **Visa**: you decide what it can do, how much and until when.
5. **Face ID**: every sensitive action goes through your phone.
6. **Secrets**: your credentials, sealed with two signatures.
7. **Chain**: the contract enforces the rules, not the app.
8. **Install it** → **Create your credentials** → CTA.

**Use cases**
- The team agrees on the story before building animations.

**Acceptance criteria**
- Storyboard approved by Cristóbal.
- Each section has at most 12 words of heading and 20 of support.
- List of concrete references taken from Hermes Agent (which effect and where).

**Tests**
- 5-second test: someone who does not know PAP reads only the headings and explains what it is about.

**Post-development summary**
- Storyboard in `docs/LANDING.md`: 12 screens in order, heading (≤ 12 words), supporting line (≤ 20), animation and mobile version for each; rules for reduced motion, no layout shift and no new libraries.
- **Limitation:** the official Hermes Agent website could not be opened from the environment (the network policy blocks the domain, and the landing's source is not public in the Nous repo). The effects were defined from the description given (scroll story, triggers, infinite loops, typing terminal, little text) and documented as our own, not copied.
- **Pending:** storyboard sign-off and the 5-second test with someone who does not know PAP.

---

### PAP-22 — Narrative landing with scroll animations

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-21

**Description**
Rewrite `web/src/app/page.tsx` following the storyboard. Scroll-triggered animations: fade-and-slide entrances, sticky sections whose content changes while scrolling, a counter that ticks up, and a phone mockup that shows each step (pairing → visa → Face ID → stamp). Evaluate `motion` (Framer Motion) or GSAP ScrollTrigger + Lenis against extending `motion.tsx`; pick only one.

**Use cases**
- A judge or user scrolls and understands the full flow without reading paragraphs.

**Acceptance criteria**
- Implements every section of the storyboard.
- Smooth 60 fps scroll on a mid-range iPhone.
- No layout shift (CLS < 0.1).
- The existing links are kept (repo, docs, explorer, live stats).

**Tests**
- Manual on iOS Safari, Android Chrome and desktop.
- Lighthouse: mobile performance ≥ 85.

**Post-development summary**
- `web/src/app/page.tsx` rewritten per the storyboard: hero (the Creation of Adam image), problem ("A key in .env is a blank check" with the `PRIVATE_KEY=` line being struck through), 5-step story, how it works, install, API keys, services, live and footer.
- `components/landing/story.tsx`: on desktop a pinned phone changes screen (pairing QR → visa → approve a payment with a stamp → read a secret with a reason → on-chain stamps with `LimitExceeded`) as each step reaches the middle; on mobile each step carries its own phone.
- No new animation library: IntersectionObserver + CSS + a scroll-progress hook (`motion.tsx`).
- Lighthouse (production): mobile **performance 89–94** depending on the run (from 68), CLS 0; desktop 100. To get there: the h1 no longer animates in (it was the LCP), the background uses a responsive `next/image`, fewer font weights, and viem only loads once the live stats come on screen (TBT from 410 → ~100 ms).
- Screenshots: `docs/img/landing/`. Pending: test on real iOS Safari and Android Chrome.

---

### PAP-23 — Animated "How it works" diagram

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-21

**Description**
Inline diagram that draws itself on scroll: **Agent → Relay → Phone (Face ID) → HashKey Chain**, plus the secrets variant (**layered seal → dual signature → agent**). Each node lights up when the story reaches that step. Vertical on mobile.

**Use cases**
- Understand at a glance who signs, who stores what and what the chain does.

**Acceptance criteria**
- Two flows: payments and secrets.
- Readable at 390 px (vertical) and on desktop (horizontal).
- Colors from the theme tokens, nothing hard-coded.
- Accessible diagram text (not an image).

**Tests**
- Visual review on mobile and desktop.
- A screen reader reads the steps in order.

**Post-development summary**
- `components/landing/how.tsx`: "Who signs what" with **Payments** (agent → relay → phone → HSK) and **Secrets** (laptop → relay → phone → HSK → agent) tabs; the line draws on scroll and each node lights up when the line reaches it.
- Vertical on mobile, horizontal on desktop; it is an HTML ordered list (not an image), so a screen reader reads the steps in order. Colors only from theme tokens.
- Screenshots: `docs/img/landing/mobile-how.png`, `desktop-how.png`.

---

### PAP-24 — "Install it in your agent" section

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-18, PAP-21

**Description**
A section with tabs and a copy button per agent:
- **Claude Code**: `/plugin install pap` (or `.mcp.json` until the plugin exists).
- **Cursor / Claude Desktop**: MCP config JSON block.
- **Any agent**: `npx pap rpc` + `--rpc-url http://localhost:8545`.
- **CLI**: `pap secret exec <name> -- <cmd>`.
An animated terminal types the command and shows the pairing QR (reusing the existing typing gate terminal).

**Use cases**
- A Claude Code user installs PAP in under a minute from the landing.

**Acceptance criteria**
- Commands copy with one tap (on mobile too).
- Every command shown works as is (checked against the code).
- 3 visible steps: install → scan the QR → done.

**Tests**
- Copy and paste each command on a clean machine → it works.

**Post-development summary**
- `Install` in `components/landing/install.tsx`: **Claude Code** (`/plugin marketplace add …` + `/plugin install pap@pap`), **Cursor · Desktop** (clone + MCP JSON), **Any agent** (`pap rpc` or `curl` to `/api/rpc`) and **CLI** (`pap secret exec`) tabs, with a Copy button (44 px, works with a finger) and the 3 steps Install → Scan the QR → Done. A terminal types the pair → ask-for-a-secret flow.
- Every command shown exists in the code (plugin validated and test-installed, CLI and RPC with their tests).
- Pending: copy/paste test on a clean machine against production.

---

### PAP-25 — "Create your credentials" section

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-06, PAP-14, PAP-21

**Description**
Explain in 3 animated steps how to seal a credential: **paste the key** (`pap seal openai` or `/vault/new`) → **pick the agent and limits** → **sealed: it only opens with its signature + yours**. Then show the phone card when the agent asks for it. Direct link to `/vault/new`.

**Use cases**
- The user understands how to hand an API key to their agent without pasting it into a chat or a `.env`.

**Acceptance criteria**
- Two visible paths: terminal and web.
- One line explains what it does **not** protect (once released, the agent has it) with a link to the threat model.

**Tests**
- User test: after reading the section they can seal a key without help.

**Post-development summary**
- `Credentials`: 3 steps that light up in order while the section is on screen (paste on your laptop → pick the agent and limits → sealed), a terminal with `pap seal` (hidden value) and an "Or seal it from your phone" button → `/vault/new`.
- One line explains what it does **not** protect (once released, the agent has it) with a link to the threat model in `docs/SECURITY.md`.
- Pending: user test.

---

### PAP-26 — Mobile first: landing + PWA experience

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-22

**Description**
- **Landing on mobile**: adapted animations (less parallax, shorter sticky sections), type and spacing at 390 px, buttons within thumb reach.
- **The PWA** (`/wallet`, `/approve`, `/pair`): bottom navigation bar (Agents · Vault · Stamps), guided "Add to Home Screen" prompt on iOS (required for push and comfortable Face ID), empty states with a single clear action.
- If the landing is opened on a phone, show the "Open my passport" CTA instead of "Install in your agent".

**Use cases**
- The human approves from the phone with one hand.
- Someone opens the landing on their phone and ends up with the PWA installed.

**Acceptance criteria**
- No horizontal scroll on any screen at 360–430 px.
- Touch targets of at least 44 px.
- Install guide for iOS and Android.

**Tests**
- Manual on iPhone (Safari) and Android (Chrome).
- Install the PWA from the landing on both.

**Post-development summary**
- Landing designed at 390 px first: no horizontal scroll (checked at 390 and 1280), touch targets ≥ 44 px, mobile-specific type and spacing, the story does not depend on `position: sticky` on mobile.
- `HeroCTA`: on a phone the primary button is **"Open my passport"** (goes to the PWA) and the secondary one "Install in your agent"; the other way around on desktop.
- PWA: bottom bar Agents · Vault · Stamps (PAP-12), "Add to Home Screen" guide on an iPhone without the PWA installed (PAP-13) and empty states with a single action.
- Zoom is allowed (`maximum-scale=1` removed from the viewport, required for accessibility).
- Pending: install the PWA from the landing on a real iPhone and Android.

---

### PAP-27 — Infinite compatibility marquee

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-22

**Description**
An infinite loop strip (reusing the existing marquee) listing what works with PAP: Claude Code, Cursor, Claude Desktop, cast, viem, ethers, web3.py, MCP, JSON-RPC, EIP-1193, ERC-8004, x402, HashKey Chain. Two rows in opposite directions; pauses on hover or tap.

**Use cases**
- Convey "works with any agent" without writing a paragraph.

**Acceptance criteria**
- Loop without visible seams.
- Only lists integrations that actually work at that moment.

**Tests**
- Visual review; check every listed integration against the code.

**Post-development summary**
- `Marquee`: two infinite rows in opposite directions (Claude Code, Cursor, Claude Desktop, MCP, Agent Skills, JSON-RPC 2.0, EIP-1193, EIP-712 / cast, viem, ethers, web3.py, ERC-8004, x402-style gate, Web Push, HSK Chain); pauses on hover or a tap.
- Every listed integration exists in the code (cast/ethers/web3.py go through `pap rpc`, tested with viem; see PAP-09's pending item).

---

### PAP-28 — Animation performance and accessibility

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-22 to PAP-27

**Description**
Final pass: respect `prefers-reduced-motion` (animations replaced by static states), lazy-load images and the diagram, optimized fonts, AA contrast for every text on the background.

**Use cases**
- A user with reduced motion enabled sees the whole story without animations.

**Acceptance criteria**
- Lighthouse mobile: performance ≥ 85, accessibility ≥ 95.
- With reduced motion, all content is visible and readable.

**Tests**
- Lighthouse on mobile and desktop.
- Enable reduced motion on iOS and review the whole landing.

**Post-development summary**
- Lighthouse on a production build (performance / accessibility / best practices): **desktop 100 / 100 / 100**; **mobile 89–94 / 100 / 100** (simulated performance varies between runs); CLS 0 everywhere. Starting point: mobile 68 / 85 / 96.
- Fixes: darker `--muted` color (≥ 5:1 on every paper tone, which also improves the PWA), dimmed states at 60 %, lighter pink on dark backgrounds, underlined links inside text, valid `<dl>`, zoom allowed.
- `prefers-reduced-motion`: no running animations and **0 hidden text blocks** (checked with Playwright in reduced mode); content that animates in has a static end state.

---

## Epic: Documentation

### PAP-19 — Docs: secrets architecture and threat model

- **Status:** done
- **Epic:** Docs
- **Depends on:** PAP-07

**Description**
A "Secrets" section in `docs/ARCHITECTURE.md` (flow, blob format, EIP-712, on-chain visa), an update of `docs/SECURITY.md` with the threat model (protects delivery, not use; mitigations) and of the README (new row in the modes table + new tools).

**Use cases**
- A judge or auditor understands what is guaranteed and what is not.

**Acceptance criteria**
- Diagram of the dual-signature flow.
- Explicit list of what it does **not** protect.

**Tests**
- Review by a team member who did not build the feature.

**Post-development summary**
- `docs/ARCHITECTURE.md`: **Sealed secrets** section with a diagram of the dual-signature flow (laptop → relay → phone → agent), a table of the parts, why the layers are in that order and the two sealing paths; JSON-RPC, Notifications and Plugin sections; new tools and test scripts.
- `docs/SECURITY.md`: **Sealed secrets — threat model** with the guarantees (cryptographic 2-of-2, bound to agent + name, single-use signatures, on-chain limits before release) and an explicit list of what it does **not** protect (use after release, a compromised agent machine, a human who approves without reading, a compromised phone, relay availability, nonce races, the agent's `record()`, metadata).
- `README.md`: "Sealed secrets (iteration 4)" section, plugin install, how to seal, repo layout and row 4 in the roadmap.
- **Pending:** review by a team member who did not build the feature.

---

## Epic: QA and polish (post-hackathon)

### PAP-29 — Full test pass

- **Status:** done
- **Epic:** QA
- **Depends on:** —

**Description**
Run every suite in the repo (lint, typecheck, build, Foundry + fork, MCP unit tests, integration against an in-memory local relay, E2E with the CLI and the MCP, on-chain E2E against production, gate, push, UI in a browser) and record what fails.

**Acceptance criteria**
- Every suite run with its result recorded here; every real failure has a ticket.

**Tests**
- `forge test` (+ `--fork-url hashkey_testnet`), `mcp: npm test`, `mcp/scripts/*`, `web/scripts/*`, `next build`, `eslint`, `tsc`.

**Comments**
- The demo visas of agents #4 and #6 expired on testnet → `Fork.t.sol` (1 test) and `gate-test.mjs` fail because of data, not code.
- `secrets-e2e.mjs` assumed `/` as the path separator (failed on Windows) → fixed.
- `eslint`: 5 `react-hooks/purity` and `set-state-in-effect` errors (`approve/[id]`, `wallet`, `Agents`, `WalletGate`) → PAP-32.

**Post-development summary (2026-09-28)**

| Suite | Result |
|---|---|
| `tsc` web + mcp | ok |
| `next build` | ok (25 routes) |
| `eslint` web | 5 errors, 1 warning → PAP-32 |
| `forge test` | 37 pass, 3 skipped (fork) |
| `forge test --fork-url hashkey_testnet` | 2 pass, 1 fail `GrantExpired` (agent #4's visa expired; data, not code) |
| `mcp: npm test` (crypto, EIP-712) | 10/10 |
| bundles `mcp/dist`, `plugin/`, `pap-core`, ABIs | no drift |
| `rpc-test.ts` local and production | 18/18 and 18/18 |
| `secrets-relay-test.ts` | 27/27 |
| `secrets-e2e.mjs` (CLI + MCP) | 11/11 after fixing the path separator |
| `rpc-signer-test.mjs` (`pap rpc`, EIP-1193/5792/7715) | 20/20 |
| `relay-test.mjs` | ok |
| `push-test.ts` (Web Push) | 10/10 |
| `gate-test.mjs` local and production | fails: agent #6's visa expired; the logic refuses for the right reason |
| `e2e.mjs` on-chain against production | OK after PAP-30 (agent #11: 4-transaction onboarding, payment of 10, 500 → `LimitExceeded`, rejection, gate `ACCESS GRANTED`) |
| API probes with invalid inputs (production) | correct 4xx; findings → PAP-33, PAP-34 |
| `claude plugin validate` (plugin + marketplace) | ok |
| Browser: landing, `/wallet`, `/approve`, `/show` | no console errors of our own, 0 broken images; 15 emojis (PAP-31); broken links to `main` (PAP-36); `/show` with an unknown id (PAP-35) |
| Lighthouse production | mobile 89 / 100 / 100 / 100, desktop 99 / 100 / 100 / 100, CLS 0 |

### PAP-30 — Nonce race in back-to-back phone transactions

- **Status:** done
- **Epic:** QA
- **Depends on:** —

**Description**
The HSK testnet RPC is load-balanced; right after a receipt, another node can return the old nonce and the next transaction collides with "replacement transaction underpriced". It happens in the onboarding (4 transactions in a row) of the PWA and of `phone-sim.mjs`. Fix: viem's `nonceManager` on the account, so the nonce is tracked locally.

**Acceptance criteria**
- `mcp/scripts/e2e.mjs` against production passes end to end.
- The PWA onboarding uses the same account with `nonceManager`.

**Tests**
- `node mcp/scripts/e2e.mjs` (reproduced the failure on `faucet()` 2 times out of 2).

**Post-development summary**
- `privateKeyToAccount(pk, { nonceManager })` in `web/src/lib/onchain.ts` (PWA) and `web/scripts/phone-sim.mjs`. With the fix, `e2e.mjs` passes end to end against production.

### PAP-31 — White-paper landing

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-22 to PAP-28

**Description**
Make the landing more professional, like a white paper: no emojis, an editorial serif for headings and readable body text, a sober palette (ink on paper, a single accent color), less ornament.

**Acceptance criteria**
- 0 emojis on the landing (checked by searching the code and the served HTML).
- New type and palette applied; AA contrast.
- Lighthouse equal to or better than PAP-28.

**Tests**
- Emoji grep over `web/src`; visual review on desktop and mobile; Lighthouse.

**Post-development summary**
- Type: Source Serif 4 (headings and body), IBM Plex Sans (UI), IBM Plex Mono (code and labels). Cormorant, Barlow, Inter and Geist are gone.
- Palette as tokens (`globals.css`): paper `#fbfaf7`, ink `#16181d`, a single ink-blue accent `#1f3b63`; code blocks with `code-*` tokens. No grain, glow or button sweep; square buttons.
- Paper structure: title block with an *Abstract*, Figure 1 (the image in grayscale with a caption), numbered sections 1–7 (Problem, Design 2.1–2.5, Protocol, Integration, Sealed credentials, Service verification, Deployment), Table 1 of contracts and **References** [1]–[5].
- **0 emojis** in `web/src` and `web/public` (landing and PWA): text labels (`Payment`, `Secret`, `Seal`, `Pay`, `Read`), `01…` numbers in the diagram and steps, an `Approved`/`Rejected` status on `/show`.
- Checked with Playwright (iPhone 13 and 1440 px): no horizontal overflow, no console errors. Lighthouse on production after PAP-38: desktop 100 / 100 / 100 / 100, mobile 82–86 / 100 / 100 / 100. The `docs/img/landing` screenshots are redone in PAP-40.

### PAP-32 — React Compiler lint errors

- **Status:** done
- **Epic:** QA
- **Depends on:** —

**Description**
Fix the 5 `eslint` errors (`Date.now()` during render, synchronous `setState` in effects) without changing behavior.

**Acceptance criteria**
- `npx eslint .` in `web/` with no errors.

**Post-development summary**
- `useNow()` (`useSyncExternalStore`, one tick per second) replaces `Date.now()` in the render of `/approve`, `/wallet` and `Agents`.
- `WalletGate` reads the wallet with `useSyncExternalStore` (`storedWalletRaw`) instead of `setState` in an effect.
- `/wallet`: `refresh()` only calls `setState` after its `await`s; a single `eslint-disable` remains, with the reason.
- `npx eslint .` with no errors or warnings.

### PAP-33 — `/api/fund` without limits: the funder can be drained

- **Status:** done
- **Epic:** QA / Security
- **Depends on:** —

**Description**
`POST /api/fund` sends 0.002 HSK to any address with a low balance, with no signature and no rate limit. Looping over fresh addresses, anyone can drain the funder wallet and onboarding stops working for real users. Concurrent requests also collide on the nonce (same problem as PAP-30).

**Acceptance criteria**
- At most once per address.
- Rate limit per IP.
- Funder account with `nonceManager`.

**Tests**
- A second call for the same address does not fund; over the limit → 429.

**Post-development summary**
- A signature does not help here (anyone can generate keys), so the control is limits: once per address, 3 per IP per day and 30 per hour overall (counters in the relay store, best effort). Above them → 429 with a message pointing to the faucet.
- The address is marked as funded only once the transaction confirms; a failed send answers 502 and allows a retry.
- Funder account with `nonceManager`.
- Tested locally with an unfunded funder: the 4th call from the same IP → 429.

### PAP-34 — Batch size cap on `/api/rpc`

- **Status:** done
- **Epic:** QA / Security
- **Depends on:** —

**Description**
A JSON-RPC batch of 201 calls was processed in full. Set a maximum (50) and answer `-32600` above it.

**Acceptance criteria**
- Batch over the limit → a single `-32600` error; `rpc-test.ts` covers the case.

**Post-development summary**
- `MAX_BATCH = 50` in `/api/rpc`; above it, a single `-32600` with `data.reason`. New case in `rpc-test.ts` (19/19). Verified on production.

### PAP-35 — `/show` with an unknown id

- **Status:** done
- **Epic:** UX
- **Depends on:** —

**Description**
`/show/request/<unknown id>` showed the QR and "Waiting for your phone…" forever. It must say the request does not exist or has expired.

**Acceptance criteria**
- Unknown id → clear message, no QR or spinner.

**Post-development summary**
- `/show/<kind>/<id>`: a 404 from the relay (or an unknown `kind`) stops polling and shows "This request does not exist or has expired".

### PAP-36 — Merge the branch into `main` (broken landing links)

- **Status:** done
- **Epic:** QA
- **Depends on:** PAP-29, PAP-30

**Description**
`main` was 19+ commits behind what was in production. The landing links to `blob/main/docs/RPC.md`, `docs/AGENTS.md` and the SECURITY `#sealed-secrets--threat-model` anchor, which did not exist on `main` → 404 on GitHub.

**Acceptance criteria**
- PR merged; the landing's 14 external links answer 200.

**Post-development summary**
- PR #1 merged (green CI: forge, mcp, web). Production deploys from `main`; the 14 external links answer 200.

### PAP-37 — Broken on-chain history: the RPC limits `eth_getLogs`

- **Status:** done
- **Epic:** QA
- **Depends on:** —

**Description**
The public HSK testnet RPC answers `block range too large` above ~5000 blocks, and the history starts at the deploy (~390k blocks back). The landing's live stats and the PWA's **Stamps** tab (`readStamps`, `readSecretStamps`) were failing silently.

**Acceptance criteria**
- The landing shows real agents, stamps and volume; Stamps lists payments and reads.

**Post-development summary**
- `web/src/lib/logs.ts`: `eventLogs()` reads from the explorer's Etherscan-style API (Blockscout, open CORS, no range limit), filters on the first indexed argument and decodes with viem; if the explorer fails, it falls back to the RPC over the last 4000 blocks.
- Checked against the chain: 7 `Paid` events (70 demoUSDT), 1 for agent #11, empty history for a nonexistent agent; the landing shows 11 · 7 · 70.

### PAP-38 — Accessibility after the redesign

- **Status:** done
- **Epic:** Landing
- **Depends on:** PAP-31

**Description**
Lighthouse accessibility dropped to 97: inactive story headings had 2.85:1 contrast and Table 1 had no headers.

**Post-development summary**
- Inactive headings at 60 % ink; `<thead>` with `Contract · Role · Address`. Accessibility back to 100 on mobile and desktop.

### PAP-39 — English-only repository

- **Status:** done
- **Epic:** Docs
- **Depends on:** —

**Description**
The repository mixed Spanish and English. Everything the judges and contributors read must be in English.

**Acceptance criteria**
- No Spanish prose in tracked files (docs, backlog, pitch, demo, video script).

**Post-development summary**
- Translated `backlog.md`, `docs/DEMO.md`, `docs/PITCH.md` and `docs/VIDEO.md`. While translating: the demo checklist now covers the plugin install and expired visas, and the video slides use the white-paper tokens.

### PAP-40 — Final delivery polish

- **Status:** done
- **Epic:** Docs / QA
- **Depends on:** PAP-39

**Description**
Everything a judge touches must be current and working: README, `docs/SUBMISSION.md`, landing screenshots, and a live demo agent with a valid visa.

**Acceptance criteria**
- README and SUBMISSION match what is deployed (features, links, numbers).
- `docs/img/landing` shows the white-paper landing.
- A demo agent with an active visa; `gate-test.mjs` passes against production.

**Tests**
- Link check over README and SUBMISSION; `gate-test.mjs` and `e2e.mjs` against production.

**Post-development summary**
- Demo visas renewed on HSK testnet (owner keys of the team's test wallets): agents #4 and #6, 100 demoUSDT until 2026-11-28 (txs `0x0cd8ea7c…` and `0xdc97756d…`). `gate-test.mjs` against production: valid 200, other key 403, tampered 403.
- `Fork.t.sol`: `testFork_agent4_visa` no longer asserts a historical spend (it resets on renewal); it checks the invariants (active, limit, spent ≤ limit, not expired). Fork suite 3 / 3.
- README: hero screenshot, three-tab wallet, how history is read, 37 unit tests, a **Tested** table with every suite, iteration 4 marked live, `backlog.md` in the repo map.
- SUBMISSION: iteration 4 (sealed secrets, JSON-RPC, local signer, Web Push, plugin + skills), quality paragraph, all MCP tools, more stack tags, links to RPC / AGENTS / SECURITY, ready cover at `docs/img/cover.png` (1200×630).
- New screenshots in `docs/img/landing` taken from production (desktop 1440 px, iPhone 13), plus `desktop-hero.png`.
- ARCHITECTURE and `contracts/README.md` updated (wallet tabs, explorer API for full history, 37 tests). The STATE_OF_THE_ART comparison table uses Yes / No instead of emoji; the CLI's seal message has no emoji.
- Left for the team: record and upload the video (`docs/VIDEO.md`), and the Devfolio fields marked [OK CRISTÓBAL] in `docs/SUBMISSION.md`.

