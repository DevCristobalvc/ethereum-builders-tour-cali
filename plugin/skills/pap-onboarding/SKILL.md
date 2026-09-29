---
name: pap-onboarding
description: Use when the user asks to connect, pair or set up PAP (Passport Agent Protocol) for this agent, when any pap_* tool says "Not paired" / "No agent identity", or the first time the user mentions giving the agent a wallet, payments or secrets through their phone.
---

# Connecting this agent to its human

The agent gets an **identity** (a key in `~/.pap/agent.json` that holds no funds). The human's phone registers it as an ERC-8004 agent they own and grants it a **visa**. Nothing is custodied by the agent.

## Steps

1. `pap_status` — already paired? Then stop here and summarize the visa.
2. `pap_connect({ name })` with a name the human will recognize on their phone, e.g. "Claude Code @ <their project>".
3. Tell the user: **scan the QR with your phone camera** (it also opens in the browser). On the phone:
   - first time: create the passkey wallet (Face ID);
   - approve 4 transactions on HSK Chain testnet (gas is sponsored): register the agent (ERC-8004), get test demoUSDT, allow the passport to move it, grant the visa (limit + days).
4. If it returns "Still waiting", call `pap_wait({ kind: "pair", id })`.
5. When paired, show the visa from `pap_status` and suggest the next steps:
   - **Notifications:** on the phone, `/wallet` → "Get approvals as notifications" (on iPhone, first Share → Add to Home Screen).
   - **Credentials:** seal API keys with `pap seal <name>` in their terminal (see `pap-seal`).

## Choosing the visa

Small and short is safer: e.g. 50 demoUSDT for 7 days. The human can always grant a new one.

## Troubleshooting

- QR doesn't open: use the phone link printed by the tool.
- "agent not paired" after scanning: the phone didn't finish the 4 transactions — reopen the link.
- Different MCP client (Cursor, Claude Desktop): `command: node`, `args: ["<repo>/mcp/dist/pap.mjs"]`, `env: { PAP_RELAY_URL: "https://pap.devcristobalvc.com" }`.
