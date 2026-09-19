# State of the Art — Anonymous Agent Passport (ZK + ERC-8004 + x402)

> Research snapshot, 2026-09-19. Hackathon: Ethereum Builders Tour Cali (EAG + HashKey Chain).

## 1. Problem

Autonomous AI agents are becoming economic actors: they hold wallets, pay for APIs and
hire other agents. Two things are missing at the same time:

1. **Trust** — how does a service know an agent is legit / vetted / has reputation?
2. **Privacy** — every ERC-8004 agent has a public `agentId` (ERC-721). Every x402 call
   it makes is linkable to that ID. Agent activity becomes a fully public behavioural graph.

Today you get one or the other. "Anonymous Agent Passport" gives both:
prove *"I am one of the vetted agents"* without revealing *which* one.

## 2. Building blocks (what exists today)

### 2.1 ERC-8004 — Trustless Agents (identity layer)
- Draft ERC, proposed Aug 2025, on Ethereum mainnet since Jan 29 2026; reference deployments
  on Base Sepolia, Linea Sepolia, Hedera testnet, Avalanche C-Chain.
- Three singleton registries per chain:
  - **Identity Registry** — `register(agentURI)` mints an ERC-721 `agentId`; `agentURI` resolves to
    a JSON "registration file" (`name`, `services[]` (A2A/MCP/web…), `x402Support`, `supportedTrust`).
  - **Reputation Registry** — `giveFeedback(agentId, value, decimals, tag1, tag2, ...)`,
    `getSummary(agentId, clients[], tag1, tag2)`.
  - **Validation Registry** — `validationRequest(validator, agentId, uri, hash)` /
    `validationResponse(hash, response, ...)` for third-party attestations (TEE, re-execution, etc.).
- **Privacy: none.** Spec explicitly has no anonymisation; all feedback/validation is public
  and keyed by `agentId`. Sybil noted as an open problem.
- Empirical study (arXiv 2606.26028): registrations grow fast but most identities are empty /
  test; reputation is thin and gameable.

### 2.2 x402 — HTTP-native payments (payment layer)
- Coinbase, May 2025 → x402 Foundation under Linux Foundation (Apr–Jul 2026, 40+ members incl.
  Cloudflare, Stripe, AWS).
- Flow: `GET /resource` → `402 Payment Required` + payment requirements → agent signs a
  stablecoin transfer (EIP-3009 / permit) → retries with `X-PAYMENT` header → facilitator settles.
- Live mainly on Base and Solana. Volume is real but small (~$28K/day real commerce, Q1 2026);
  the *rails* are here, the *trust layer* is the gap.
- No identity in the protocol: the payer is just an address. Services cannot tell
  "vetted agent" from "random bot" without linking to ERC-8004 → linkability problem.

### 2.3 ZK identity / anonymous credentials (privacy layer)
- **Semaphore (PSE)** — the canonical pattern: identity commitment in a Merkle group,
  Groth16 proof of membership + **nullifier** (signal-scoped) to prevent double-use. v4 live.
- **World ID** — proof-of-personhood; `nullifier_hash` per action. Already combined with
  ERC-8004 in `eltociear/agent-passport` (World ID × ERC-8004 on Base, "1 human ≤ 3 agents").
- **ZK passports** (Self, Rarimo, Anon Aadhaar, zkPassport) — prove attributes from government
  docs. Mature for *humans*, not agents.
- **Microsoft Vega**, **ZK-AMS** (arXiv 2602.16130), **"ZK predicate proofs between agents"**
  (arXiv 2608.30083) — academic work on agents proving predicates about credentials to each
  other. No production integration with ERC-8004 / x402 found.
- **zkpjwt-core** (ours, npm) — Groth16 + Poseidon Merkle membership for up to 1024 leaves,
  browser-side proving (snarkjs), 1 public signal (`root`). Built for Arbitrum Stylus (ARG25).

### 2.4 HashKey Chain (target chain)
- OP-stack L2, compliance / RWA / regulated stablecoin narrative. EVM-compatible.
- Testnet: chainId **133**, RPC `https://testnet.hsk.xyz`, explorer
  `https://hashkeychain-testnet-explorer.alt.technology`, gas token HSK, faucet 0.01 HSK/day.
- Strong fit: "compliant but private" is literally their pitch, and no ERC-8004 registry is
  deployed there yet (we can be first).

## 3. Gap analysis

| Need | ERC-8004 | x402 | Semaphore / World ID | agent-passport (World ID) | **Ours** |
|---|---|---|---|---|---|
| Agent identity on-chain | ✅ | ❌ | ❌ | ✅ | ✅ (ERC-8004) |
| Reputation / validation | ✅ | ❌ | ❌ | ✅ | ✅ (reads registry) |
| Pay per request | ❌ | ✅ | ❌ | ❌ | ✅ (x402 flow) |
| Prove "vetted" w/o revealing agentId | ❌ | ❌ | ✅ (generic) | partial (human, not agent set) | ✅ |
| Unlinkable across services | ❌ | ❌ | ✅ | partial | ✅ (nullifier per service) |
| Needs orb / gov ID | – | – | World ID: yes | yes | **no** |
| HashKey Chain | ❌ | ❌ | ❌ | ❌ | ✅ |

## 4. Our thesis — Anonymous Agent Passport

**"Prove you're a trusted agent. Don't say which one."**

1. Agents register in an ERC-8004 Identity Registry on HashKey Chain testnet and accumulate
   reputation / validations.
2. A **Passport Issuer** (contract + indexer script) computes the *set* of agents meeting a
   policy (e.g. `reputation ≥ X` or `validated by validator V`) and publishes a Poseidon
   Merkle root of their agent wallets → `PassportRegistry.setRoot(epoch, root)`.
3. An agent generates a Groth16 proof (client-side, `zkpjwt-core`) that it is in the set,
   bound to a `serviceId` nullifier so the same agent cannot be traced across services
   but cannot spam one service either.
4. An x402-style gate (`402 → proof + payment → 200`) verifies the proof on-chain
   (`Groth16Verifier.sol` exported from the same zkey) and serves the request.

Innovation is in the **composition**: first design that connects ERC-8004 reputation sets →
ZK membership → x402 access, on a compliance-first chain, without World ID / gov ID.

## 5. Risks / honest limitations
- `zkpjwt-core` circuit has **no nullifier** (1 public signal). For the hackathon we either
  (a) add a nullifier circuit (circom, ~2h, needs trusted setup) or (b) bind proofs off-chain
  with a signed challenge. Plan: (b) first, (a) if time.
- Anonymity set = size of the vetted set (small on testnet). Fine for demo.
- ERC-8004 is Draft; interfaces may still move. We vendor a minimal implementation.
- x402 facilitators do not support HashKey Chain yet → we implement the 402 handshake ourselves
  with a simple ERC-20 payment on testnet.

## Sources
- ERC-8004 spec — https://eips.ethereum.org/EIPS/eip-8004
- ERC-8004 reference contracts — https://github.com/erc-8004/erc-8004-contracts
- awesome-erc8004 — https://github.com/sudeepb02/awesome-erc8004
- QuickNode dev guide — https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/
- "Can Trustless Agents Be Trusted?" (arXiv 2606.26028) — https://arxiv.org/html/2606.26028
- Agent-to-Agent Finance (arXiv 2607.00245) — https://arxiv.org/pdf/2607.00245
- ENS on ERC-8004 identity — https://ens.domains/blog/post/ens-ai-agent-erc8004
- OriginTrail "Passport, please!" — https://medium.com/origintrail/passport-please-ai-agents-are-becoming-first-class-citizens-with-erc-8004-origintrail-27fb90af8af9
- eltociear/agent-passport (World ID × ERC-8004) — https://github.com/eltociear/agent-passport
- x402 — https://x402.org/ ; Coinbase launch — https://www.coinbase.com/developer-platform/discover/launches/x402
- x402 Foundation — https://blockeden.xyz/blog/2026/03/05/x402-foundation-ai-payment-internet/
- x402 adoption reality check — https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet
- x402 comparison 2026 — https://wavect.io/blog/x402-payments-comparison-2026/
- ZK proofs production-ready 2026 — https://wavect.io/blog/zero-knowledge-proofs-production-2026/
- ZK predicate proofs between agents (arXiv 2608.30083) — https://arxiv.org/pdf/2608.30083
- ZK-AMS anonymous admission (arXiv 2602.16130) — https://arxiv.org/pdf/2602.16130
- Binding Agent ID (arXiv 2512.17538) — https://arxiv.org/pdf/2512.17538
- AI Identity standards & gaps (arXiv 2604.23280) — https://arxiv.org/pdf/2604.23280
- Microsoft Vega — https://www.microsoft.com/en-us/research/blog/vega-zero-knowledge-proofs-for-digital-identity-in-the-age-of-ai/
- CoinDesk: AI agents need identity + ZK — https://www.coindesk.com/opinion/2025/11/19/ai-agents-need-identity-and-zero-knowledge-proofs-are-the-solution
- HashKey Chain docs — https://docs.hashkeychain.net/docs/Developer-QuickStart ; testnet — https://chainlist.org/chain/133
- zkpjwt-core — https://www.npmjs.com/package/zkpjwt-core ; https://github.com/DevCristobalvc/zkp-jwt
