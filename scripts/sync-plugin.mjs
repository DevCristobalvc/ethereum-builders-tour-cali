#!/usr/bin/env node
/**
 * Builds plugin/ (the Claude Code plugin) from the sources of truth:
 *   .claude/skills/*        → plugin/skills/*   (CLI paths rewritten to ${CLAUDE_PLUGIN_ROOT})
 *   mcp/dist/pap.mjs        → plugin/dist/pap.mjs
 *   mcp/dist/pap-cli.mjs    → plugin/dist/pap-cli.mjs
 * A plugin is copied into a cache on install, so it cannot reference files outside itself.
 *   node scripts/sync-plugin.mjs          # write
 *   node scripts/sync-plugin.mjs --check  # exit 1 if plugin/ is stale (CI)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugin");
const want = new Map();

for (const f of ["pap.mjs", "pap-cli.mjs"]) want.set(join("dist", f), readFileSync(join(root, "mcp/dist", f)));
const skillsDir = join(root, ".claude/skills");
for (const s of readdirSync(skillsDir).filter((d) => d.startsWith("pap-"))) {
  const md = readFileSync(join(skillsDir, s, "SKILL.md"), "utf8").replaceAll("node mcp/dist/pap-cli.mjs", 'node "${CLAUDE_PLUGIN_ROOT}/dist/pap-cli.mjs"');
  want.set(join("skills", s, "SKILL.md"), Buffer.from(md));
}

const stale = [...want].filter(([rel, buf]) => !existsSync(join(plugin, rel)) || !readFileSync(join(plugin, rel)).equals(buf));
const current = (dir) => (existsSync(join(plugin, dir)) ? readdirSync(join(plugin, dir), { recursive: true, withFileTypes: true }) : [])
  .filter((e) => e.isFile())
  .map((e) => join(dir, join(e.parentPath ?? e.path, e.name).slice(join(plugin, dir).length + 1)));
const extra = [...current("skills"), ...current("dist")].filter((rel) => !want.has(rel));

if (process.argv.includes("--check")) {
  if (stale.length || extra.length) {
    console.error(`plugin/ is stale (${[...stale.map(([r]) => r), ...extra].join(", ")}) — run: node scripts/sync-plugin.mjs`);
    process.exit(1);
  }
  console.log("plugin in sync");
} else {
  for (const rel of extra) rmSync(join(plugin, rel));
  for (const [rel, buf] of want) {
    mkdirSync(dirname(join(plugin, rel)), { recursive: true });
    writeFileSync(join(plugin, rel), buf);
  }
  console.log(`plugin/: ${want.size} files`);
}
