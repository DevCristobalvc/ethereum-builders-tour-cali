# PAP contracts — HashKey Chain testnet (133)

Foundry project. Solidity 0.8.28, optimizer 200, `via_ir`, EVM cancun.

| Contract | Purpose | Address (all verified on [Blockscout](https://testnet-explorer.hskchain.net)) |
|---|---|---|
| `IdentityRegistry` | ERC-8004 identity: agent = ERC-721 owned by the human; `register(uri, agentWallet)` | `0x9a074B1BD632D93b20BF468Cd23C0a9794F2e50F` |
| `AgentPassport` | The **visa**: `grant` (human) → `pay` / `record` (agent, on-chain limit + expiry) | `0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B` |
| `DemoUSDT` | 6-dec demo stablecoin, public `mint` / `faucet()` | `0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84` |
| `ReputationRegistry` | ERC-8004 feedback | `0xf935f364f797AF2336FfDb3ee06431e1616B7c6C` |
| `PassportRegistry` + `Groth16Verifier` | ZK anonymous passport (iteration 3) | `0x4bB5791e89b4B2aA9D435CCB7F428626c790f10C` / `0xEBB0A2188451e702c4905168d465FCCbdf44B229` |

ABIs: `../deployments/abi/*.json` · addresses: `../deployments/133.json`.

## Test

```bash
forge test                                                        # 25 unit tests (fork tests auto-skip)
forge test --match-contract Fork --fork-url https://testnet.hsk.xyz   # 3 tests against the live deployment
```

The fork tests read the real `agentId #4` (created by the PAP E2E demo) and assert the visa state,
then prank the agent key to pay inside the visa and get reverted outside it.

## Iteration 2 — the agent operates alone, inside the visa

Human approves **once** (`approve` + `grant`), afterwards the agent key pays without the human.
The limit and expiry are enforced by the contract, not by the app.

```bash
# .env: PRIVATE_KEY (human), AGENT_PRIVATE_KEY (agent identity key), TEST_ADDRESS (recipient)
source .env
forge script script/AgentPay.s.sol:FundAgent --sig "run(address)" $AGENT_ADDRESS \
  --rpc-url hashkey_testnet --broadcast              # 0.002 HSK gas for the agent key
forge script script/AgentPay.s.sol:AgentPay --rpc-url hashkey_testnet --broadcast
```

Live run on testnet (agentId **6**, agent key `0x5c0046d560cC0892C5fF0dB123BDF8B1605Ae287`):

| Step | Signer | Tx |
|---|---|---|
| `register(uri, agentKey)` | human | [`0x874e18…fe768`](https://testnet-explorer.hskchain.net/tx/0x874e189a5c7377e83ec9607293c91592f8371ce3ef1e52080aff35d49b2fe768) |
| `approve(passport, max)` | human | [`0x32ca10…7ac75`](https://testnet-explorer.hskchain.net/tx/0x32ca1036252dafc3bb13581ab6544e2d7197e94295d8d8c66b6d5c143837ac75) |
| `grant(6, transfer:demoUSDT, 100, 24h)` | human | [`0x307119…c055d2`](https://testnet-explorer.hskchain.net/tx/0x307119a70d172715134f4b4734534ba95d2bdd270b3f3b7084be752092c055d2) |
| `pay(6, demoUSDT, maría, 10)` | **agent key, no human** | [`0x629de0…c756f`](https://testnet-explorer.hskchain.net/tx/0x629de0c7927fe7a44796698f1bb8c56d6a6d0f67d3ea1cda19541bc8c15c756f) |

Same thing with `cast`:

```bash
R=https://testnet.hsk.xyz
AP=0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B
USDT=0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84
SCOPE=$(cast call --rpc-url $R $AP 'transferScope(address)(bytes32)' $USDT)

# agent pays 10 demoUSDT (signed by the agent key only)
cast send --rpc-url $R --private-key $AGENT_PRIVATE_KEY $AP \
  'pay(uint256,address,address,uint256,bytes32)' 6 $USDT $TO 10000000 $(cast keccak invoice-002)

# check the visa
cast call --rpc-url $R $AP 'getGrant(uint256,bytes32)(uint256,uint256,uint64,bool)' 6 $SCOPE
cast call --rpc-url $R $AP 'canAct(uint256,bytes32,uint256)(bool)' 6 $SCOPE 500000000   # false
```

## Gas on HSK Chain

Measured from the real testnet receipts of the AgentPay run (gas price 1 gwei; HSK ≈ USD 0.5 → 1 M gas ≈ $0.0005).

| Operation | Signer | Gas | Cost @1 gwei |
|---|---|---|---|
| `register(uri, agentKey)` (ERC-8004 mint) | human, once | 190 180 | 0.000190 HSK |
| `approve(passport, max)` | human, once | 46 269 | 0.000046 HSK |
| `grant(agentId, scope, limit, expiry)` (issue visa) | human | 77 369 | 0.000077 HSK |
| **`pay(agentId, token, to, amount, ref)`** (agent, autonomous) | agent key | **81 286** | **0.000081 HSK** |
| `record(agentId, scope, 1, ref)` (non-transfer action) | agent key | ~43 000 (forge median) | 0.000043 HSK |
| `revoke(agentId, scope)` | human | ~29 800 (forge) | 0.000030 HSK |

Onboarding a new agent end-to-end (register + approve + grant) ≈ 314 k gas ≈ **0.0003 HSK**;
each autonomous payment afterwards ≈ 81 k gas, i.e. ~25 % over a plain ERC-20 `transferFrom`
for the on-chain visa check + audit trail. Deploying all six contracts cost 3.79 M gas (0.0038 HSK).
Regenerate: `forge test --gas-report`.

## Visas for any action — scope convention

`AgentPassport` never interprets a scope: it is any `bytes32`. `grant` / `record` / `canAct` work
with all of them (`record` is callable by the human **or** the agent key). `pay` is just
`record` + `transferFrom` for the `transfer:` family. Convention (`src/Scopes.sol`, tests in `test/Scopes.t.sol`):

| Scope | bytes32 | `amount` | typical `limit` |
|---|---|---|---|
| `transfer:<token>` | `keccak256(abi.encodePacked("transfer:", token))` | token units | e.g. `100e6` |
| `call:<contract>:<selector>` | `keccak256(abi.encodePacked("call:", target, selector))` | `1` per call | `N` or `type(uint256).max` |
| `sign:<domain>` | `keccak256(abi.encodePacked("sign:", domain))` | `1` per signature | `N` |
| `secret:<name>` | `keccak256(abi.encodePacked("secret:", name))` | `1` per read | `1` (single use) |

Countable actions: `limit = N` uses (or `type(uint256).max` = unlimited, still expirable), `amount = 1`.
`limit = 0` means no cap. viem: `keccak256(concatHex([stringToHex("sign:"), stringToHex(domain)]))`.

## Passport stamps — reading an agent's history

`ActionRecorded(uint256 indexed agentId, bytes32 indexed scope, uint256 amount, bytes32 indexed ref, address recordedBy)`
— `agentId`, `scope` and `ref` are indexed, so explorers / the PWA can filter by topic.

```bash
# all stamps of agent 6 (deploy block 33334362)
cast logs --rpc-url https://testnet.hsk.xyz --from-block 33334362   --address 0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B   'ActionRecorded(uint256 indexed agentId, bytes32 indexed scope, uint256 amount, bytes32 indexed ref, address recordedBy)' 6

# or decoded:
forge script script/ReadHistory.s.sol --sig "run(uint256)" 6 --rpc-url hashkey_testnet
```

viem (PWA): `pub.getLogs({ address: AgentPassport, event: parseAbiItem('event ActionRecorded(uint256 indexed agentId, bytes32 indexed scope, uint256 amount, bytes32 indexed ref, address recordedBy)'), args: { agentId }, fromBlock: 33334362n })`.

## Deploy

```bash
source .env   # PRIVATE_KEY, TEST_ADDRESS
forge script script/Deploy.s.sol --rpc-url hashkey_testnet --broadcast   # writes ../deployments/133.json
forge script script/Seed.s.sol   --rpc-url hashkey_testnet --broadcast   # 10k demoUSDT + gas to test wallet
./export-abi.sh
```

Verification: `forge verify-contract --verifier sourcify --chain 133 ...` works out of the box.
Blockscout's gateway rejects large standard-JSON (413); for contracts importing OpenZeppelin we
submit a comment-stripped flattened source as standard-JSON with `viaIR: true` (see `deployments/flat/`).
