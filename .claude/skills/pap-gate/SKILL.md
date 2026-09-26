---
name: pap-gate
description: Use when an HTTP request returns 402 Payment Required with a "pap-visa" scheme, when calling the PAP demo oracle, or when a service says it accepts agent visas / x402-style PAP access. Handles the challenge with pap_call_gate without bothering the human.
---

# Calling a visa-gated service

A PAP gate answers `402` with a challenge. The agent signs it with its identity key; the service checks **on HSK Chain** that the key belongs to the ERC-8004 agent and that its visa is active. No human prompt, no raw API key.

## Steps

1. Call `pap_call_gate({ url })` (no `url` → the demo price oracle at `<relay>/api/gate/oracle`).
2. `ACCESS GRANTED` → use the returned data.
3. `ACCESS DENIED 403` → the visa is missing, expired or used up. Tell the user; they renew it on their phone (pairing / visa screen). Do not look for another way in.
4. `service does not accept pap-visa` → it's a different scheme; ask the user how they want to pay or authenticate.

## Prefer the gate over secrets

If a service offers both a PAP gate and an API key you could request with `pap_secret`, use the gate: the credential is the on-chain visa and no secret ever leaves the vault.

## Protocol (for building a client in another language)

`GET url` → `402 {accepts:[{scheme:"pap-visa", challenge, header:"X-PAP-VISA"}]}` → sign `PAP:gate:{"agentAddress","agentId","challenge"}` (keys sorted) with personal_sign → retry with header `X-PAP-VISA: base64(JSON{agentAddress, agentId, challenge, sig})` → `200`. Details in `docs/GATE.md`.
