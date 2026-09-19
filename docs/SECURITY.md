# Security notes — AgentPassport & friends (hackathon build)

Scope: `contracts/src/AgentPassport.sol`, `IdentityRegistry.sol`. Quick self-review, not an audit. No admin keys, no upgradeability, no pause: what is deployed is what runs.

## What holds

- **CEI in `pay`.** `_consume` checks the grant, increments `spent` and emits *before* `safeTransferFrom`. A reentrant token cannot exceed the visa: the second entry sees the updated `spent`. `token` is caller-supplied, but the scope is `transfer:<token>`, so a malicious token only matters if the human explicitly granted a visa for it.
- **Limit and expiry are enforced on-chain**, not by the app. `spent + amount > limit` and `block.timestamp > expiry` revert; Solidity 0.8 checked math means a `spent` overflow reverts rather than wraps.
- **Authorisation is resolved at call time**: `ownerOf(agentId)` and `getAgentWallet(agentId)` are read on every `pay`/`record`; revoking, changing the agent key or transferring the NFT takes effect immediately.
- **Gate is not bearer-token based**: `/api/gate/oracle` recovers the signer and checks `getAgentWallet(agentId) == signer` and `canAct(...)` on-chain per request; challenges are HMAC-signed and expire in 5 min.
- Tests: 31 unit (incl. fuzz over arbitrary scopes/limits) + 3 fork tests against the live deployment.

## Known limitations (honest list)

1. **`limit = 0` means "no cap".** Footgun: a UI that sends `0` meaning "nothing" grants unlimited. The PWA never does, but the contract should not have this dual meaning.
2. **Grants travel with the ERC-8004 NFT.** Grants are keyed by `agentId`, so if the human transfers the agent token, the new owner inherits every open visa and `pay` pulls from *their* balance (only if they also `approve`d). Old owner is safe; new owner may be surprised.
3. **Agent key can be squatted in the reverse index.** `register(uri, agentWallet)` and `setAgentWallet` take no signature from `agentWallet` (EIP-8004 requires one), so anyone can point an agent at any address and overwrite `agentIdOf(addr)`. Forward lookup (`getAgentWallet(agentId)`) — what the gate uses — is unaffected.
4. **Front-running `revoke`.** An agent key that watches the mempool can `pay` right before a `revoke`/`grant` lands. HSK Chain is an OP-stack L2 with a sequencer (no public mempool), and the damage is bounded by the remaining visa, but it is not zero.
5. **Non-transfer scopes are honour-system unless something calls `record`.** `sign:`/`secret:`/`call:` visas only count if the gate/MCP consumes them (`record`, costs gas). The oracle gate today only *reads* `canAct(…, 0)`, so a read visa is effectively unlimited. Fine for a read-only oracle, not for side effects.
6. **`ref` is a memo, not a nonce.** Repeated refs are allowed; replay protection of the *action* comes from the visa accounting, not from `ref`.
7. **Timestamp granularity.** `expiry` is `uint64` seconds against `block.timestamp`; the sequencer can skew by seconds. Never issue visas that need sub-minute precision.
8. **`pay` pulls from the human's wallet via a max `approve` to AgentPassport.** A bug in AgentPassport = exposure of the full token balance. The contract is 100 lines and has no admin path, but this is the trust assumption.
9. **DemoUSDT has public `mint`** and ReputationRegistry has no Sybil resistance — testnet demo pieces.
10. **ZK PassportRegistry (iteration 3)**: the zkpjwt circuit has no nullifier signal; the nullifier is assigned off-chain. Proof verification on-chain is real, unlinkability is not yet.

## What we'd fix for mainnet

- Replace `limit == 0 → unlimited` with an explicit `unlimited` flag; make `0` mean zero.
- Clear all grants of an `agentId` on NFT transfer (`_update` hook in IdentityRegistry → `AgentPassport.onAgentTransferred`), or key grants by `(owner, agentId)`.
- Require an EIP-712 signature from `agentWallet` in `register`/`setAgentWallet` (as EIP-8004 specifies) and a `deadline`.
- Per-scope **rate limits** (amount per window) in addition to cumulative limit + expiry, and a global per-agent daily cap.
- `pay` with `permit`/EIP-3009 instead of a standing max allowance, or an allowance equal to the visa limit that AgentPassport tops up on `grant`.
- Nullifier inside the ZK circuit; `verifyPassport` consumes it on-chain.
- External audit + Slither/Foundry invariant tests (`spent <= limit` for every grant, `sum(Paid) == sum(ActionRecorded[transfer:])`).
