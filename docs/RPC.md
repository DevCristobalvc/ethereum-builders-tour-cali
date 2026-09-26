# PAP over JSON-RPC

Two JSON-RPC surfaces, for agents that don't speak MCP:

| Surface | Where | For |
|---|---|---|
| **Relay API** — `pap_*` namespace | `POST https://pap.devcristobalvc.com/api/rpc` | Any agent in any language (Go, Rust, Python, A2A workers) |
| **Local signer** — Ethereum JSON-RPC (EIP-1193) | `pap rpc` → `http://127.0.0.1:8545` | Tools that already talk to an Ethereum node: `cast`, viem, ethers, web3.py |

## Relay API (`/api/rpc`)

JSON-RPC 2.0: single calls, batches (`[...]`), notifications (no `id` → no response, `204` if the whole batch is notifications). Params by name (`{...}`) or a single by-position object (`[{...}]`). `GET /api/rpc` (or `rpc.discover`) lists the methods.

Every method delegates to the REST route that implements it, so signatures and checks are identical to [`ARCHITECTURE.md`](ARCHITECTURE.md#relay-api-websrcappapi).

| Method | Params | Result |
|---|---|---|
| `pap_requestTransfer` | `{agentAddress, action:{type:"transfer", token, to, amount, memo?}, sig}` — `sig` = personal_sign over `PAP:request:<sorted JSON of {agentAddress, action}>` | `{requestId, url, showUrl, expiresAt}` |
| `pap_requestSecret` | `{agentAddress, action:{type:"reveal", name, reason, nonce, expiry}, sig}` — `sig` = EIP-712 `RevealRequest` | `{requestId, url, showUrl, expiresAt}` |
| `pap_sealSecret` | `{agentAddress, name, blob, maxReads, expiry, nonce, sig, grantTx?}` — `sig` = EIP-712 `SealRequest` by the agent (→ pending, the phone approves) or the owner (→ active) | `{status, requestId?, url?}` |
| `pap_getRequest` | `{id}` | `{status: pending\|approved\|rejected\|expired, txHash?, result?, approvalSig?}` |
| `pap_listSecrets` | `{agent}` or `{owner}` | `[{name, status, reads, maxReads, expiry, lastReadAt?}]` (never values) |
| `pap_getAgent` | `{address}` | `{ownerAddress, agentId, agentPublicKey?, ownerPublicKey?}` |
| `pap_canAct` | `{agentId, scope, amount}` | `bool` — `AgentPassport.canAct` on HSK Chain |
| `pap_chainId` | — | `"0x85"` (HSK Chain testnet, 133) |
| `pap_contracts` | — | deployed addresses |
| `rpc.discover` | — | method list |

EIP-712 domain: `{name: "PAP", version: "1", chainId: 133, verifyingContract: AgentPassport}`; types in [`mcp/src/pap-core.ts`](../mcp/src/pap-core.ts) (`papTypes`).

### Errors

| Code | Meaning | From |
|---|---|---|
| `-32700` / `-32600` / `-32601` / `-32602` / `-32603` | JSON-RPC 2.0 standard | — |
| `-32000` | invalid input: bad signature, nonce reused | HTTP 401 / 409 |
| `-32001` | resource not found (agent, secret, request) | HTTP 404 |
| `-32002` | resource unavailable (agent not paired) | HTTP 403 |
| `-32003` | visa / secret expired | HTTP 410 |
| `-32005` | limit exceeded (secret read limit) | HTTP 429 |
| `4001` | user rejected (EIP-1193) — local signer only; on the relay a rejection is a request with `status: "rejected"` | — |

`error.data.httpStatus` carries the original REST status.

### Example: read a secret from any language

```bash
# 1. sign EIP-712 RevealRequest {agent, name, reason, nonce, expiry} with the agent key, then:
curl -s https://pap.devcristobalvc.com/api/rpc -H 'content-type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"pap_requestSecret",
  "params":{"agentAddress":"0x…","action":{"type":"reveal","name":"openai","reason":"Run the nightly sync","nonce":"a1b2c3d4e5","expiry":"1790000000"},"sig":"0x…"}}'
# 2. poll pap_getRequest until status != pending
# 3. result = inner blob → ECIES-decrypt with the agent key (openAgentLayer in pap-core.ts)
```

Tests: `mcp/scripts/rpc-test.ts` (conformance + parity with REST).

## Local signer (`pap rpc`)

```bash
node mcp/dist/pap-cli.mjs rpc --port 8545     # uses the agent identity in ~/.pap/agent.json
cast balance 0xYourPhoneWallet --rpc-url http://127.0.0.1:8545
cast send 0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84 "transfer(address,uint256)" 0xMaria 5000000 \
  --rpc-url http://127.0.0.1:8545 --unlocked --from 0xYourAgent
```

viem: `createWalletClient({ account: agentAddress, transport: http("http://127.0.0.1:8545") })` — ethers: `new JsonRpcProvider("http://127.0.0.1:8545").getSigner()` — web3.py: `Web3(HTTPProvider("http://127.0.0.1:8545"))`.

| Method | Behaviour |
|---|---|
| reads (`eth_chainId`, `eth_call`, `eth_getBalance`, `eth_getLogs`, receipts, blocks, `eth_sendRawTransaction`…) | forwarded to HSK Chain (`PAP_RPC_URL`, default `https://testnet.hsk.xyz`) |
| `eth_accounts` / `eth_requestAccounts` | `[agentAddress]` — an identity key, it holds no funds |
| `eth_sendTransaction` — ERC-20 `transfer(to, amount)` | a PAP payment from the **human's** wallet: the agent pays alone via `AgentPassport.pay` if its visa covers it and it has gas; otherwise the phone approves (Face ID). Returns the tx hash; rejection → `4001` |
| `eth_sendTransaction` — to `AgentPassport` (`pay`, `record`) | signed by the agent; the contract enforces the visa |
| `eth_sendTransaction` — anything else | refused with `4200`, **never signed** |
| `eth_estimateGas` | answered locally for brokered transfers (the agent holds no tokens, so HSK would revert); forwarded otherwise |
| `personal_sign`, `eth_sign`, `eth_signTypedData_v4` | signed by the agent identity (other `from` → `4100`) |
| `eth_getEncryptionPublicKey` | the agent's compressed secp256k1 key (what secrets are sealed to) |
| `eth_decrypt("pap:secret:<name>")` or `{"pap":"secret","name","reason"}` | the sealed-secret flow: phone approval → plaintext. MetaMask's `x25519-xsalsa20-poly1305` blobs are refused (`4200`) — PAP secrets use layered ECIES, see `pap-core.ts` |
| `wallet_getCapabilities` | `{ "0x85": { pap: { secrets, visas, gate } } }` |
| `wallet_grantPermissions` (EIP-7715 subset) | one `erc20-token-allowance` permission → reports the on-chain visa; granting stays on the phone (the agent can only ask) |
| `wallet_sendCalls` / `wallet_getCallsStatus` (EIP-5792) | each transfer follows the `eth_sendTransaction` rules in order (one approval per call); `atomicRequired: true` → `5760` |

Listens on `127.0.0.1` only. Tests: `mcp/scripts/rpc-signer-test.mjs` (viem + fake HSK node + headless phone, 20 checks).
