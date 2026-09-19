# Anonymous Agent Passport — Hackathon Plan

Ethereum Builders Tour Cali · 2026-09-19/20 · HashKey Chain testnet (chainId 133)

Stack: Foundry (Solidity) · Next.js + TypeScript · wagmi/viem · zkpjwt-core (Groth16 + Poseidon Merkle) · snarkjs

Pitch: **"Prove you're a trusted agent. Don't say which one."** ERC-8004 reputation → ZK membership proof → x402-style gated access, on HashKey Chain.

---

## T0 — Repo & tooling
- **status:** done
- **description:** GitHub repo `devcristobalvc/ethereum-builders-tour-cali`, monorepo layout (`contracts/`, `web/`, `docs/`), Foundry installed, `.gitignore`, README skeleton.
- **acceptance:** `git push` works; `forge build` runs; `npm run dev` in `web/` boots.
- **tests:** none (infra).
- **comments:** gh device login pending (code 4B4A-C0E2). Chrome extension not connected → user logs in manually.

## T1 — ERC-8004 minimal registries (Solidity)
- **status:** done
- **description:** `IdentityRegistry` (ERC-721, `register(agentURI)`, `getAgentWallet`), `ReputationRegistry` (`giveFeedback`, `getSummary`). Minimal but interface-compatible with EIP-8004 so the story is "real ERC-8004".
- **acceptance:** an agent can register, get an `agentId`, receive feedback; summary readable on-chain.
- **tests:** Foundry: register mints and emits `Registered`; feedback updates summary; only agent owner can `setAgentURI`.
- **comments:** vendor-lite, no external deps except OpenZeppelin ERC721.

## T2 — Groth16 verifier + PassportRegistry (Solidity)
- **status:** done
- **description:** `snarkjs zkey export solidityverifier merkle_final.zkey` → `Groth16Verifier.sol`. `PassportRegistry`: `setRoot(root)` (issuer only), `verifyPassport(proof, root, serviceId, nullifier)` → checks root == current root, verifier ok, nullifier unused per `serviceId`.
- **acceptance:** valid proof passes; wrong root / replayed nullifier reverts.
- **tests:** Foundry with a fixture proof generated off-chain (`test/fixtures/proof.json`); fuzz on bad inputs.
- **comments:** 9/9 forge tests pass with a real proof fixture (`scripts/gen-fixture.mjs`). `via_ir` needed for ReputationRegistry event. Circuit has no nullifier signal → v1 nullifier = `keccak(serviceId, signature over challenge)` checked off-chain in the gate; on-chain we only verify membership. Upgrade to circuit nullifier if time.

## T3 — Passport issuer script (TS)
- **status:** todo
- **description:** `scripts/issue-passports.ts`: reads `IdentityRegistry` + `ReputationRegistry` events, filters agents by policy (`summaryValue >= MIN_REP`), builds Poseidon Merkle tree with `zkpjwt-core.MerkleTreeBuilder`, calls `PassportRegistry.setRoot`. Writes `web/public/passport-set.json` (leaves) so agents can build their Merkle path.
- **acceptance:** running the script after seeding 5 agents (3 good, 2 bad) publishes a root containing exactly the 3 good ones.
- **tests:** vitest: tree from fixture addresses matches expected root; policy filter unit test.
- **comments:** for demo, the set file is public (anonymity set = vetted agents). Fine.

## T4 — x402-style gate (Next.js API route)
- **status:** todo
- **description:** `GET /api/oracle` → `402` with JSON `{ accepts: [{ scheme:"zk-passport", root, serviceId, challenge }] }`. Retry with header `X-PASSPORT: base64(proof, publicSignals, nullifier, sig)` → server verifies Groth16 client-side (`ProofVerifier`) + calls `PassportRegistry.verifyPassport` via viem read → `200` with payload. Optional `X-PAYMENT` with ERC-20 tx hash on HashKey testnet.
- **acceptance:** curl flow: 402 → 200 with a valid passport; 402/403 with invalid/replayed one.
- **tests:** route unit tests with mocked verifier; integration against anvil.
- **comments:** we mimic x402 headers/shape so judges recognize it; no external facilitator (none support HashKey).

## T5 — Agent client + demo UI (Next.js)
- **status:** todo
- **description:** Page 1 "Registry": register agent (wagmi), give feedback. Page 2 "Passport": connect agent wallet → fetch set → `MerkleTreeBuilder.getMerkleProof` → `ProofGenerator.generateProof` (browser, wasm/zkey from `/assets`) → show proof. Page 3 "Gate": hit `/api/oracle`, show 402 → proof → 200 live, with explorer links.
- **acceptance:** end-to-end demo on HashKey testnet in < 60s, no backend secrets.
- **tests:** Playwright smoke (optional if time).
- **comments:** UI keep simple; the live 402→200 moment is the demo.

## T6 — Deploy to HashKey Chain testnet
- **status:** todo
- **description:** `forge script` deploy T1+T2, seed 5 agents + feedback, run T3, record addresses in `deployments/hashkey-testnet.json` and README.
- **acceptance:** all contract addresses verified on `hashkeychain-testnet-explorer.alt.technology`; UI points to them.
- **tests:** `cast call` sanity on root + summary.
- **comments:** faucet 0.01 HSK/day → get funds early (day 1 morning).

## T7 — Docs, pitch, submission
- **status:** todo
- **description:** README (problem, architecture diagram, how to run, addresses), `docs/STATE_OF_THE_ART.md` (done), 3-min demo video, submission form.
- **acceptance:** a judge can clone + run in 5 min; video uploaded.
- **tests:** none.
- **comments:** emphasize: first ERC-8004 + ZK + x402 composition; HashKey "compliant but private" fit; reuses own npm lib.

## Stretch
- Nullifier inside the circuit (circom `merkle_membership` + `Poseidon(secret, serviceId)`).
- Stylus/Arbitrum port for gas comparison table (we already have numbers from zkpjwt).
- Agent-to-agent flow (agent A pays agent B via the gate).
