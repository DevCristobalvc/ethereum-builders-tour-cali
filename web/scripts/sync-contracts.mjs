// Copies ABIs + deployment addresses from ../deployments into src/generated so the
// Vercel build (root = web/) has everything it needs.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "deployments");
const out = join(import.meta.dirname, "..", "src", "generated");
mkdirSync(out, { recursive: true });

const abis = {};
for (const f of readdirSync(join(root, "abi"))) {
  if (!f.endsWith(".json")) continue;
  abis[f.replace(".json", "")] = JSON.parse(readFileSync(join(root, "abi", f), "utf8"));
}
writeFileSync(join(out, "abis.json"), JSON.stringify(abis));

const depFile = join(root, "133.json");
const deployments = existsSync(depFile) ? JSON.parse(readFileSync(depFile, "utf8")) : {};
writeFileSync(join(out, "deployments.json"), JSON.stringify({ 133: deployments }, null, 2));
console.log("synced", Object.keys(abis).length, "ABIs; deployments:", Object.keys(deployments));
