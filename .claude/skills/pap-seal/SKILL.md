---
name: pap-seal
description: Use when the user wants to give their agent an API key, token or other credential with PAP (e.g. "save my OpenAI key for the agent", "store my Stripe token", "the agent needs my GitHub token"), or when pap_secret says a secret does not exist. Guides them to seal it from their own terminal so the value never goes through the chat.
---

# Sealing a credential for the agent

The value must go **from the user's keyboard straight into the encryption**, never through this conversation.

## If the user pastes a secret into the chat

Tell them plainly that it is now in the conversation history, recommend rotating it at the provider, and continue with the steps below using the new value. Do not repeat, store or use the pasted value.

## Steps (the user runs these, in their own terminal)

1. **Pick a name**: lowercase, e.g. `openai`, `stripe`, `github`.
2. **Seal it** (from the repo, or wherever the PAP CLI is):

   ```bash
   node mcp/dist/pap-cli.mjs seal openai --max-reads 10 --days 7
   ```

   It asks for the value with a hidden prompt (or reads it from stdin: `pbpaste | node mcp/dist/pap-cli.mjs seal openai`). The key is encrypted on their laptop in two layers — their phone's and the agent's — and the relay only receives ciphertext.
3. **Approve on the phone.** A QR / link opens: Face ID grants the on-chain visa (`--max-reads` reads until `--days`). Until then the secret is not active.
4. **Check**: `pap_secrets_list` should show `openai: active · 0/10 reads`.

## Choosing the limits

- Short-lived and few reads is safer: `--max-reads 5 --days 1` for a one-off task.
- A provider key with its own spending cap or restricted scopes limits the damage if it ever leaks.
- To change the value later: revoke it in the phone app (**Vault → Rotate**), rotate it at the provider, then seal the new one.

## Web alternative

On the phone app, **Vault → Seal a secret** encrypts in the browser and activates it with one Face ID (no terminal needed).
