---
name: pap-rpc
description: Use when the task runs Ethereum tooling — cast / Foundry, viem, ethers, web3.py, Hardhat scripts — against HSK Chain and would otherwise need a private key in .env or --private-key, or when a script calls eth_sendTransaction / eth_decrypt. Starts the PAP local signer so those tools work with the human's phone approval instead of a key.
---

# Ethereum tools without a private key: `pap rpc`

Never put a private key in `.env`, a script or a command line. Run the PAP local signer and point the tool at it.

## Start it

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/pap-cli.mjs" rpc --port 8545 &     # identity from ~/.pap/agent.json (pair first: pap_connect)
```

## Use it

```bash
cast chain-id --rpc-url http://127.0.0.1:8545                    # reads go straight to HSK Chain
cast send <token> "transfer(address,uint256)" <to> <amount> \
  --rpc-url http://127.0.0.1:8545 --unlocked --from <agentAddress>  # → approval on the human's phone
```

- viem: `createWalletClient({ account: "<agentAddress>", transport: http("http://127.0.0.1:8545") })`
- ethers: `await new JsonRpcProvider("http://127.0.0.1:8545").getSigner()`
- web3.py: `Web3(HTTPProvider("http://127.0.0.1:8545"))`, `from` = the agent address

## What it will and won't do

- ERC-20 `transfer(to, amount)` → a PAP payment from the **human's** wallet (the agent pays alone only inside an active visa with gas; otherwise Face ID on the phone). Rejected → error `4001`: stop, don't retry.
- Calls to `AgentPassport` (`pay`, `record`) → signed by the agent, enforced by the contract.
- **Anything else is refused (`4200`) and never signed.** Don't try to work around it; tell the user what the transaction needs.
- Secrets: `eth_decrypt("pap:secret:<name>")` runs the sealed-secret approval (prefer `pap_secret` / `pap secret exec`, see `pap-secrets`).
- `wallet_getCapabilities` tells you what's available.

Full method table: `docs/RPC.md`.
