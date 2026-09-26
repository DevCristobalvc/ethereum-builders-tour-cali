# Autonomous secret reads — research (PAP-20)

**Question.** Payments already have two modes: *human in the loop* (Face ID per payment) and *autonomous inside the visa* (the agent pays alone; the contract enforces limit and expiry). Can sealed secrets have the second mode — "read `openai` up to 20 times this week without asking me" — without giving up the 2-of-2 guarantee?

**Why it isn't free.** Today the second key is the phone's. If nobody holds that key at read time, nobody can remove the outer layer. Anything that removes it automatically becomes the new trusted party, so the question is **who holds the second share, and what makes it obey the on-chain visa**.

## Options

### 1. Pre-released inner blob ("unlock once") — rejected

The phone peels once and hands the agent the inner blob for later use. After that the agent can decrypt at will: equivalent to giving it the key. The on-chain read counter would be decorative. Not a real mode.

### 2. Always-on phone auto-responder — rejected for now

The phone approves automatically while `canAct(agentId, secret:<name>, 1)` is true. iOS gives PWAs no background execution; push can wake the service worker, but decrypting with a Face-ID-wrapped key needs user presence. It only works on a device that stays unlocked and online — a server, not a phone.

### 3. Owner-delegated "custodian key" in a TEE — **recommended next step**

The owner seals with a third layer, or re-seals the outer layer to a **custodian key** that lives in a trusted execution environment (e.g. an enclave service with remote attestation). Per read the custodian:

1. verifies the agent's EIP-712 `RevealRequest`;
2. calls `AgentPassport.record(agentId, secret:<name>, 1, ref)` — reverts unless the visa allows the read;
3. only then peels its layer and returns the inner blob (still encrypted to the agent).

- **Keeps:** 2-of-2 (agent key + custodian key), on-chain limits and expiry, the audit trail, revocation (`revoke()` stops it immediately).
- **Trust moves** from the human's phone to the enclave code + attestation. The owner opts in per secret ("autonomous for 7 days") and can see and revoke the delegation on the phone.
- **Cost:** someone runs the enclave; each read is one on-chain `record()` (gas, paid by the custodian).
- **Fits what exists:** same blob format with a different outer recipient, same relay request type, same phone Vault (showing "autonomous until …").

### 4. Threshold decryption network — longer term

Encrypt the outer layer to a threshold network (Lit Protocol–style access control, or a threshold committee like Shutter's keypers) with an access condition "`AgentPassport.canAct(agentId, secret:<name>, 1)` is true on HSK Chain". Nodes release decryption shares only when the condition holds; no single node can decrypt.

- **Keeps:** no single custodian; the condition is read from the chain.
- **Open questions:** whether the network supports HashKey Chain or arbitrary EVM RPCs for conditions (to verify per provider); **counting** — `canAct` is a *view*, so reads must still be consumed by someone calling `record()` first, or the limit is only checked, not spent; latency and fees; dependency on an external network.

### 5. Credential proxy (the secret never leaves) — complementary

Instead of releasing the key, a PAP gate holds it (in a TEE) and injects it into outbound API calls when the agent presents a valid visa (`pap-visa` scheme, like `/api/gate/oracle`). The agent never sees the key at all — strictly better on "use after release" (threat #1 in `SECURITY.md`) — but it needs a proxy per API and only works for HTTP APIs.

## Comparison

| | Keeps 2-of-2 | Limits enforced | Agent sees the value | Extra infra | Effort |
|---|---|---|---|---|---|
| 1. Unlock once | no | no | yes | none | — |
| 2. Phone auto-responder | yes | yes | yes | always-on device | low, impractical |
| **3. TEE custodian** | **yes** | **yes (`record` before release)** | yes | enclave service | **medium** |
| 4. Threshold network | yes (t-of-n) | checked; counting needs `record` | yes | external network | high |
| 5. Credential proxy | n/a (key never released) | yes, per call | **no** | proxy per API | medium |

## Recommendation

1. **Next:** option 3 as an opt-in per secret ("autonomous until <date>"), reusing the blob format and the phone Vault; the enclave must call `record()` *before* releasing, so on-chain accounting stays the source of truth.
2. **In parallel, for HTTP APIs:** option 5, because it removes the biggest remaining risk (the agent holding the raw key).
3. **Later:** evaluate option 4 once a threshold network can read HashKey Chain conditions; pair it with a `record()` call so reads are spent, not just checked.

No prototype was built for this ticket: each option needs infrastructure (enclave, network) outside this repo.
