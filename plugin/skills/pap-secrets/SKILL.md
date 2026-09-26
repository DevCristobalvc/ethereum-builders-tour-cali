---
name: pap-secrets
description: Use whenever the task needs an API key, token, password or any credential (OpenAI, Stripe, GitHub, a database URL…) and the project uses PAP (Passport Agent Protocol) — before reading .env files, asking the user to paste a key, or giving up. Gets the credential through the human's phone approval with pap_secret or the `pap secret` CLI, and keeps it out of the conversation.
---

# Getting a credential through PAP

Your human sealed their credentials so that each one opens only with **your signature + their Face ID**. You ask, they read your reason on their phone, they approve, and only then is the value decrypted with your identity key.

## Three rules (never break them)

1. **Always say why.** The `reason` is exactly what your human reads before deciding. Make it concrete and tied to what they asked you to do: "Run the integration tests that call the OpenAI API", not "need key".
2. **Never expose a secret.** Do not print, echo, log, paste, commit, or write the value anywhere except where the tool puts it. Do not include it in your replies, in code, in test fixtures or in `.env` files you create.
3. **A rejection is final.** If your human rejects, stop and tell the user what you could not do. Do not retry, rephrase the reason to try again, or look for the value elsewhere (shell history, other files, other tools).

## Steps

1. **Prefer not to need the raw key.** If the service is behind a PAP gate (it answers `402` with `pap-visa`), use `pap_call_gate` — the visa is the credential and no secret is released.
2. **Check what exists:** `pap_secrets_list` (MCP) or `pap secret list` (CLI). Names are lowercase, e.g. `openai`, `stripe`.
3. **If it doesn't exist:** ask the user to seal it from **their own terminal** — `pap seal <name>` (see the `pap-seal` skill). Never ask them to paste the value into the chat.
4. **Ask for it:**
   - MCP: `pap_secret({ name, reason })`. The default `deliver: "file"` writes it to `~/.pap/secrets/<name>` (mode 0600) and returns only the path — the value never enters the conversation. Use `deliver: "inline"` only if a tool truly needs the literal string and there is no other way.
   - CLI (any agent that runs commands): prefer `pap secret exec <name> --reason "…" -- <command>`, which sets `PAP_SECRET_<NAME>` only for that command.
5. **If it says "Waiting for your human"**, tell the user to check their phone, then call `pap_wait` with `kind: "secret"`, the returned `id` and the `name`.
6. **Use it without echoing:** `OPENAI_API_KEY="$(cat ~/.pap/secrets/openai)" npm test` — not `cat` on its own, not `echo $KEY`.
7. **Clean up:** delete `~/.pap/secrets/<name>` when the task is done.

## Errors

| Message | What to do |
|---|---|
| `Rejected by your human… Do not retry.` / exit code 4 | Stop. Tell the user which step needed the credential. |
| `expired` / exit code 5 | Ask the user whether to request again; do not loop. |
| `no active secret` | Ask the user to `pap seal <name>`. |
| `read limit` / `expired - ask your human to seal it again` | The visa for that secret is used up: the user must seal it again. |
| `reason required` | Write a concrete reason (10+ characters). |
| `Not paired` | Use the `pap_connect` tool first. |

What PAP guarantees: the value is released only with both signatures, the relay never sees it, and every read is stamped on HSK Chain. What it does **not** guarantee: once you have the value, protecting it is on you — hence rule 2.
