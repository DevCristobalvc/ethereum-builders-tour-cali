/**
 * End-to-end: MCP client → pap server → relay (prod) → headless phone (wallet 2) → HSK Chain.
 *   node scripts/e2e.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PAP_HOME = mkdtempSync(join(tmpdir(), "pap-e2e-"));
const RELAY = process.env.PAP_RELAY_URL ?? "https://pap.devcristobalvc.com";
const phone = (...args) =>
  console.log(execFileSync("node", ["../web/scripts/phone-sim.mjs", ...args], { encoding: "utf8", env: { ...process.env, PAP_RELAY_URL: RELAY } }));

const client = new Client({ name: "e2e", version: "0" });
await client.connect(
  new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { ...process.env, PAP_HOME, PAP_RELAY_URL: RELAY, PAP_WAIT_MS: "2000", PAP_NO_BROWSER: "1" },
  })
);
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.map((c) => c.text).join("\n");
  console.log(`\n▶ ${name}(${JSON.stringify(args)})\n${t}`);
  return t;
};

console.log("PAP_HOME", PAP_HOME);
await call("pap_status");
let out = await call("pap_connect", { name: "e2e-agent" });
const pairId = out.match(/id="([^"]+)"/)?.[1];
if (!pairId) throw new Error("no pairId");
phone("pair", pairId);
out = await call("pap_wait", { kind: "pair", id: pairId });
if (!/Paired/.test(out)) throw new Error("pair failed");

await call("pap_contact_add", { name: "maria", address: "0x7d70253e702954Ef9Ac2c0D74F9BE35F15524821" });
await call("pap_status");

out = await call("pap_transfer", { to: "maria", amount: "10", memo: "e2e test payment" });
const reqId = out.match(/id="([^"]+)"/)?.[1];
if (!reqId) throw new Error("no requestId");
phone("approve", reqId);
out = await call("pap_wait", { kind: "request", id: reqId });
if (!/APPROVED/.test(out)) throw new Error("transfer not approved");

// Over the visa limit (100) must be rejected on-chain by pay()
out = await call("pap_transfer", { to: "maria", amount: "500", memo: "should exceed visa" });
const reqId2 = out.match(/id="([^"]+)"/)?.[1];
try {
  phone("approve", reqId2);
  console.log("!! expected revert");
} catch (e) {
  console.log("✓ pay() reverted over limit (expected)");
  phone("reject", reqId2);
}
await call("pap_wait", { kind: "request", id: reqId2 });

// Iteration 2: the agent accesses a visa-gated service on its own (x402-style handshake)
out = await call("pap_call_gate", {});
if (!/ACCESS GRANTED/.test(out)) throw new Error("gate denied a paired agent");

await call("pap_status");
await client.close();
console.log("\nE2E OK");
