# Pitch — Passport Agent Protocol (PAP)

> Showcase: **3 min demo + 2 min Q&A**. Sunday, September 20, 13:30–17:00, SIDOC Auditorium (ICESI, Cali).
> Tracks: EAG *AI x Ethereum & Agent Economy* · HashKey Chain *AI Agents / Payments*.

Anchor line: **"Your agent has a passport: you stamp its visas from your phone, and services let it through without knowing who you are."**

Line for HashKey: **"Compliant but private."**

---

## 3-minute script

### 0:00 – 0:30 · The problem (hook)

> Raise your hand if you have ever put a private key in a `.env` so an AI agent could do something for you.
>
> That is where we are today. An agent like Claude Code has two options: **either it holds the key and can do EVERYTHING**, forever, with nobody checking... or **it has nothing** and you end up copying and pasting transactions by hand.
>
> There is no middle ground. There is no way for a human to approve *this specific action* from a device they trust, and to leave a record, **verifiable on-chain**, of who authorized which agent to do what.

### 0:30 – 1:00 · The solution (one image)

> We built **Passport Agent Protocol**. The idea fits in one sentence:
>
> **Your agent has a passport, you stamp its visas from your phone, and services let it through without knowing who you are.**
>
> - The **passport** is an on-chain ERC-8004 identity.
> - The **visas** are permissions (`grant`) with a scope, a limit and an expiry, which only the human who owns the passport can issue.
> - And the agent **never sees a secret**: the only key lives on the phone, behind Face ID.

### 1:00 – 2:15 · Live demo (see `DEMO.md`)

> This is Claude Code, a real agent. I ask it: *"pay 5 demoUSDT to the oracle"*.
>
> *(Claude calls the MCP tool `pap_transfer` → a QR appears in the terminal.)*
>
> The agent has no key. All it can do is **ask for permission**.
>
> *(Scan with the iPhone → the PWA shows: "Claude Code wants to send 5 demoUSDT to 0x…")*
>
> I see exactly what it wants to do, in plain language. I approve with Face ID.
>
> *(The phone signs ONE transaction, `AgentPassport.pay()` on HashKey Chain → the relay returns the hash → Claude keeps working and shows the explorer link.)*
>
> Done. Human in the loop, in 15 seconds, from the phone. And this is **on-chain**: here in the explorer is the ERC-8004 registration (I own the passport; the agent only has an address) and the demoUSDT visa with its limit and the recorded spend. And if the agent asks for more than the limit, **the contract reverts**. It is not a server rule; it is on-chain.

### 2:15 – 2:45 · Why it matters / why HashKey

> Any service can check *"this agent is authorized by a real human for this scope and still has allowance left"* with one call, `canAct(agentId, scope, amount)`, **without knowing who the human is**.
>
> For HashKey Chain this is **compliant but private**: an auditable trail of authorization, without exposing identities. It is exactly the infrastructure that agent payments, stablecoins and RWA need on a regulated L2.

### 2:45 – 3:00 · Roadmap and close

> What you saw is iteration 1. Iteration 2 is live too: an **x402**-style gate. `GET /api/gate/oracle` answers `402` with a challenge, the agent signs it, the gate checks the visa on-chain and answers `200`. Any service can put up that border in 100 lines. Iteration 3, already researched and with contracts deployed: a **ZK passport**, where the agent proves with Groth16 that it *is one of the authorized agents* without revealing *which one*.
>
> Passport Agent Protocol. Thank you.

---

## Likely Q&A

### "Why doesn't the passkey sign the on-chain transaction directly?"
Honest answer: the passkey does **not** sign on-chain. The passkey (WebAuthn / P-256) protects the key **inside the device**: on iOS 18+ we use the WebAuthn **PRF** extension to derive a secret that encrypts (AES-GCM) the secp256k1 EOA; without PRF, the passkey still requires Face ID before every signature. That EOA is what signs the transaction. This works on any EVM chain without precompiles. The roadmap is **RIP-7212** (P-256 precompile, already on several OP-stack L2s) + **account abstraction (ERC-4337)** so that the passkey becomes the signer of a smart account directly. Since the human is simply the *owner* of the ERC-8004 NFT, it can be an EOA today and a smart account tomorrow without changing `AgentPassport`.

### "Why HashKey Chain?"
Three reasons: (1) it is an EVM-compatible OP-stack L2, so the whole stack (Foundry, viem, ERC-8004) runs unchanged; (2) its narrative is **compliance + RWA + regulated stablecoins**, exactly the context where "an agent moved money and nobody knows who authorized it" is unacceptable; (3) PAP gives HashKey a primitive nobody else has: agent authorization that is **auditable yet private**.

### "What if the agent is malicious (prompt injection, compromised model)?"
Nothing happens that the human did not explicitly approve. The agent **has no key**; its attack surface is "ask for permission". Every request is shown in plain language on the phone before signing, and grants have an on-chain **scope, limit and expiry**, with every use recorded (`record`): even if the human approves absent-mindedly, the agent cannot go beyond 100 demoUSDT in total or touch another scope. Revoking is one transaction (`revoke`). Compare with `.env`: there, one injection drains the whole wallet.

### "What about Sybil? Can one human create a thousand agents?"
Yes, and that is not a problem for this model: the guarantee is not "1 human = 1 agent" but **"this agent has an accountable human with bounded permissions"**. If a service needs proof of personhood, `register` can require a credential (World ID, ZK passport) as a condition; it is on the ZK roadmap and the pattern already exists (World ID's `agent-passport` × ERC-8004). Also, ERC-8004 reputation (`ReputationRegistry`) accrues per agent, so a thousand new agents are a thousand agents with no reputation.

### "Why a single `pay()` transaction instead of `transfer` + `record`?"
Because that way the limit is enforced **atomically in the contract**: `pay()` checks the grant (scope, limit, expiry), moves the tokens and records the use in the same transaction. An agent cannot "transfer and forget to record". We tested it: 500 demoUSDT against a limit of 100 reverts with `LimitExceeded()`. `record()` is for actions that are not token transfers (iteration 2, x402 gate; sealed-secret reads).

### "How is this different from a multisig / a Safe with a module?"
A Safe protects *one* wallet with *n* human signers. PAP solves the opposite case: *one* human supervising *n* autonomous agents, with per-scope permissions and native integration in the agent's loop through **MCP** (the agent literally has an "ask for permission" tool). And the human→agent link is public and verifiable by third parties with a single call, without exposing the human.

### "Why ERC-8004 and not a custom identity?"
Because it has been on mainnet since January 2026 and it is the standard the industry is adopting for agent identity (Identity + Reputation + Validation registries). Our `IdentityRegistry` is interface-compatible, and the human→agent link is literally the standard's `register(agentURI, agentWallet)` (human = NFT owner): any existing ERC-8004 agent can receive PAP grants without registering again.

### "How much of this works today?"
Everything you saw runs on HashKey testnet: 6 deployed contracts (`deployments/133.json`), relay + PWA at `pap.devcristobalvc.com`, MCP server and Claude Code plugin in the repo. The E2E flow is tested: 10 demoUSDT approved (tx `0xe152…b04e23`) and 500 demoUSDT rejected on-chain with `LimitExceeded()`. Sealed secrets (API keys released with the agent's signature plus the owner's Face ID), a JSON-RPC 2.0 interface and a local EIP-1193 signer work too. The Groth16 verifier + PassportRegistry are also deployed and tested (9/9) for the ZK iteration; the circuit is `zkpjwt-core`, our own library on npm. The x402 gate (`/api/gate/oracle`, `docs/GATE.md`) works as well. What is missing: wiring the ZK proof into the gate (iteration 3).

### "What happens if the phone is lost?"
The human owns the ERC-721: transfer the NFT to the new wallet (or make the owner a cold wallet / Safe from the start) and re-issue the grants. Grants expire on their own. It is the same recovery model as any NFT.

---

## Minimal slides (if there is a projector)

1. Title + anchor line
2. `.env` vs nothing: the problem in one image
3. Diagram: Claude Code → MCP → Relay → iPhone (Face ID) → HashKey Chain
4. Demo (live or video)
5. "Compliant but private": why HashKey
6. Roadmap: Iter 2 x402 gate · Iter 3 ZK passport
7. Team + repo + QR to the explorer
