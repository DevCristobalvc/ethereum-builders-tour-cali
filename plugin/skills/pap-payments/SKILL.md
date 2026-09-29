---
name: pap-payments
description: Use when the task involves paying, sending, transferring or tipping tokens (demoUSDT on HSK Chain) or paying for a service, and the project uses PAP (Passport Agent Protocol). Covers checking the visa first, asking the human to approve with pap_transfer, and what to do on rejection or over-limit.
---

# Paying through PAP

You never hold the money. The human's wallet pays through `AgentPassport.pay()`, and the contract enforces the **visa** they granted you (scope, limit, expiry). Over the limit the transaction reverts on-chain with `LimitExceeded()`.

## Rules

1. **Explain the payment in plain words.** The `memo` is what the human reads on their phone: "Pay Maria for the dataset (invoice 42)", not "transfer".
2. **Never split a payment to get around the limit.** If it doesn't fit the visa, tell the user and let them raise the limit on their phone.
3. **A rejection is final.** Don't retry, don't try another route (another token, another address, `pap rpc`).

## Steps

1. `pap_status` — are you paired? What's the visa (limit, spent, remaining, expiry)?
2. **Recipient:** use a saved contact name when there is one (`pap_contact_add({name, address})` to save), otherwise a full `0x` address the user gave you. Never guess or complete an address.
3. **Pay:** `pap_transfer({ to, amount, memo })`. It shows a QR / sends a notification; the human approves with Face ID; you get the tx hash and explorer link.
4. **Still waiting?** Tell the user to check their phone and call `pap_wait({ kind: "request", id })`.
5. **Report** the explorer link to the user.

## Paying a service instead of a person

If the service answers HTTP `402` with a `pap-visa` offer, use `pap_call_gate` (see the `pap-gate` skill) — no payment approval needed while the visa is active.

## From scripts and tools

`pap rpc` exposes the same flow as an Ethereum node: an ERC-20 `transfer(to, amount)` sent with `eth_sendTransaction` becomes a PAP payment (see the `pap-rpc` skill).

| Message | Meaning / what to do |
|---|---|
| `REJECTED by the human… Do not retry` | Stop, tell the user. |
| `LimitExceeded` / reverted over limit | Visa too small: the user raises it on their phone. Do not split. |
| `Request expired (10 min)` | Ask the user whether to try again. |
| `Unknown recipient` | Ask for the address or save the contact. |
