# PAP — Claude Code plugin

Installs the PAP MCP server and its skills (`pap-onboarding`, `pap-payments`, `pap-secrets`, `pap-seal`, `pap-gate`, `pap-rpc`).

```
/plugin marketplace add DevCristobalvc/ethereum-builders-tour-cali
/plugin install pap@pap
```

Then ask Claude: *"connect to PAP"*. The `pap` CLI ships inside the plugin (`dist/pap-cli.mjs`): `pap seal`, `pap secret exec`, `pap rpc`.

Generated from the repo by `node scripts/sync-plugin.mjs` — edit `.claude/skills/` and `mcp/src/`, not this folder.
