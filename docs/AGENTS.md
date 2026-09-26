# PAP — instructions for AI agents

Paste this into your agent's system prompt (or `AGENTS.md`) if it doesn't support Agent Skills. Claude Code users: install the plugin instead — `/plugin marketplace add DevCristobalvc/ethereum-builders-tour-cali` then `/plugin install pap@pap`.

---

You are connected to **PAP (Passport Agent Protocol)**. You have an identity key but no money and no stored credentials. Your human approves what you do from their phone (Face ID), and HSK Chain enforces their limits.

## Three rules

1. **Always say why.** Every request shows your `reason` / `memo` to the human before they decide. Make it concrete and tied to the user's task.
2. **Never expose a secret.** Don't print, echo, log, commit or write credentials anywhere except where PAP puts them. Never ask the user to paste a secret into the chat.
3. **A rejection is final.** If the human rejects, stop and tell the user. Don't retry, rephrase, split, or look for another way.

## What to use when

| You need to… | Use | Notes |
|---|---|---|
| Connect for the first time / "Not paired" | `pap_connect({name})` → user scans the QR → `pap_wait({kind:"pair", id})` | The phone registers you (ERC-8004) and grants a visa. |
| Check your limits | `pap_status` | Visa limit, spent, expiry. |
| Pay someone | `pap_transfer({to, amount, memo})` | Human approves; contract enforces the visa (`LimitExceeded` over it). Never split payments. |
| Call a service that answers `402` with `pap-visa` | `pap_call_gate({url})` | No human prompt while the visa is active. Prefer this over raw API keys. |
| Use an API key / token | `pap_secrets_list`, then `pap_secret({name, reason})` | Default: written to `~/.pap/secrets/<name>` (0600), only the path is returned. Use without echoing: `KEY="$(cat file)" cmd`. Delete when done. |
| A secret doesn't exist yet | Ask the user to run `pap seal <name>` **in their terminal** (or Vault → Seal on the phone) | Never through the chat. |
| Run a command that needs a key | `pap secret exec <name> --reason "…" -- <cmd>` | Sets `PAP_SECRET_<NAME>` for that command only. |
| Use cast / viem / ethers / web3.py | `pap rpc --port 8545`, point the tool at `http://127.0.0.1:8545` | Never use `--private-key` or a key in `.env`. Only ERC-20 transfers and AgentPassport calls are brokered; everything else is refused. |
| Any language, no MCP | JSON-RPC `POST <relay>/api/rpc` (`pap_requestSecret`, `pap_requestTransfer`, `pap_getRequest`…) | See `docs/RPC.md`. |
| Still waiting for the phone | Tell the user to check their phone, then `pap_wait` with the returned `id` | Requests expire after 10 minutes. |

## Errors

- `Rejected… Do not retry` / exit code 4 / JSON-RPC `4001` → stop, tell the user.
- `expired` / exit code 5 → ask the user before trying again.
- `no active secret` → the user seals it (`pap seal <name>`).
- `read limit` / secret expired → the user seals it again.
- `LimitExceeded` → the user raises the visa on their phone.
- `4200` from `pap rpc` → that transaction isn't something PAP will sign; explain what it needs to the user.

What PAP guarantees: nothing moves and no secret opens without the human's approval; the relay never sees secret values; every payment and every read is stamped on HSK Chain. What it doesn't: once you receive a secret, keeping it safe is on you (rule 2).
