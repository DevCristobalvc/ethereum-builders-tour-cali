/**
 * End-to-end for sealed secrets with the real bundles: MCP server (pap_secret) + CLI (pap seal /
 * pap secret exec) + headless phone. Relay-only by default (PAP_SIM_NO_CHAIN=1, local dev server);
 * point PAP_RELAY_URL at production and unset PAP_SIM_NO_CHAIN to include HSK Chain.
 *
 *   cd web && npx next dev -p 3055
 *   cd mcp && PAP_RELAY_URL=http://localhost:3055 node scripts/secrets-e2e.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey } from "viem/accounts";

const RELAY = process.env.PAP_RELAY_URL ?? "http://localhost:3055";
const PAP_HOME = mkdtempSync(join(tmpdir(), "pap-secrets-e2e-"));
const env = {
  ...process.env,
  PAP_HOME,
  PAP_RELAY_URL: RELAY,
  PAP_NO_BROWSER: "1",
  PAP_WAIT_MS: "1500",
  PAP_SIM_NO_CHAIN: process.env.PAP_SIM_NO_CHAIN ?? "1",
  PHONE_PRIVATE_KEY: process.env.PHONE_PRIVATE_KEY ?? generatePrivateKey(),
};
const phone = (...args) => console.log(execFileSync("node", ["--no-warnings", "../web/scripts/phone-sim.mjs", ...args], { encoding: "utf8", env }));
const cli = (args, input) => spawnSync("node", ["dist/pap-cli.mjs", ...args], { encoding: "utf8", env: { ...env, PAP_WAIT_MS: "20000" }, input });
const idOf = (out) => out.match(/id="([^"]+)"/)?.[1] ?? out.match(/approve\/([a-z0-9]+)/)?.[1];
let n = 0;
const check = (label, cond, extra = "") => {
  if (!cond) throw new Error(`✗ ${label}\n${extra}`);
  n++;
  console.log(`✓ ${label}`);
};

const client = new Client({ name: "secrets-e2e", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/pap.mjs"], env }));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.map((c) => c.text).join("\n");
  console.log(`\n▶ ${name}(${JSON.stringify(args)})\n${t}`);
  return t;
};

// pair
let out = await call("pap_connect", { name: "secrets-e2e-agent" });
phone("pair", idOf(out));
out = await call("pap_wait", { kind: "pair", id: idOf(out) });
check("agent paired", /Paired/.test(out), out);

// human seals from their terminal (value on stdin)
let r = cli(["seal", "openai", "--max-reads", "3", "--days", "1"], "sk-e2e-VALUE-42\n");
check("pap seal → pending approval", r.status === 0 && /Sealed "openai"/.test(r.stdout), r.stderr + r.stdout);
phone("approve", idOf(r.stdout));
out = await call("pap_secrets_list");
check("secret active and listed without value", /openai: active · 0\/3 reads/.test(out) && !out.includes("sk-e2e"), out);

// agent asks via MCP; phone approves; file delivery
out = await call("pap_secret", { name: "openai", reason: "Run the integration tests against the OpenAI API" });
check("pap_secret waits for the phone", /pap_wait/.test(out), out);
const rid = idOf(out);
phone("approve", rid);
out = await call("pap_wait", { kind: "secret", id: rid, name: "openai" });
const file = join(PAP_HOME, "secrets", "openai");
check("secret delivered to a 0600 file, not into the conversation", existsSync(file) && readFileSync(file, "utf8") === "sk-e2e-VALUE-42" && !out.includes("sk-e2e"), out);

// short reason is refused before reaching the phone
const bad = await client.callTool({ name: "pap_secret", arguments: { name: "openai", reason: "need" } });
check("vague reason refused", bad.isError === true || /reason/.test(JSON.stringify(bad.content)));

// rejection via MCP is final
out = await call("pap_secret", { name: "openai", reason: "Deploy the staging environment now" });
phone("reject", idOf(out));
out = await call("pap_wait", { kind: "secret", id: idOf(out), name: "openai" });
check("rejection reported, told not to retry", /Rejected/.test(out) && /Do not retry/.test(out), out);

// CLI: run a child process with the secret in its env only; approve / reject while it waits
const cliAsync = (args, onRequest) =>
  new Promise((resolve) => {
    const child = spawn("node", ["dist/pap-cli.mjs", ...args], { env: { ...env, PAP_WAIT_MS: "60000" } });
    let stdout = "";
    let stderr = "";
    let fired = false;
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => {
      stderr += d;
      const id = stderr.match(/approve\/([a-z0-9]+)/)?.[1];
      if (id && !fired) {
        fired = true;
        onRequest(id);
      }
    });
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
const probe = "process.stdout.write(process.env.PAP_SECRET_OPENAI === 'sk-e2e-VALUE-42' ? 'ENV_OK' : 'ENV_MISSING')";
r = await cliAsync(["secret", "exec", "openai", "--reason", "Run the nightly data sync job", "--", "node", "-e", probe], (id) => phone("approve", id));
check("pap secret exec injects PAP_SECRET_OPENAI into the child only", r.code === 0 && r.stdout === "ENV_OK", JSON.stringify(r));
r = await cliAsync(["secret", "get", "openai", "--reason", "Print it for debugging please", "--stdout"], (id) => phone("reject", id));
check("CLI rejection exits with code 4 and prints nothing", r.code === 4 && r.stdout === "", JSON.stringify(r));

// read limit (3): two reads used (MCP + exec) → one left, then the relay refuses
r = await cliAsync(["secret", "get", "openai", "--reason", "Third and last allowed read"], (id) => phone("approve", id));
check("third read allowed (file path printed)", r.code === 0 && r.stdout.trim().endsWith("/secrets/openai"), JSON.stringify(r));
r = cli(["secret", "get", "openai", "--reason", "Fourth read should be refused"]);
check("read limit enforced by the relay", r.status === 1 && /read limit/.test(r.stderr), r.stderr);

await client.close();
console.log(`\n${n} checks passed · PAP_HOME=${PAP_HOME}`);
