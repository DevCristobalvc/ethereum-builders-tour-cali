// PAP Gate handshake test: 402 → sign challenge with the agent key → 200; random key → 403.
// Usage: node scripts/gate-test.mjs [baseUrl] [agentId]
//   AGENT_PRIVATE_KEY is read from ../contracts/.env (agent #6 by default).
import { readFileSync } from "node:fs";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const BASE = process.argv[2] ?? process.env.GATE_URL ?? "http://localhost:3000";
const AGENT_ID = process.argv[3] ?? process.env.AGENT_ID ?? "6";
const PATH = "/api/gate/oracle";

const envText = (() => { try { return readFileSync(new URL("../../contracts/.env", import.meta.url), "utf8"); } catch { return ""; } })();
const envVar = (k) => process.env[k] ?? envText.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const AGENT_PK = envVar("AGENT_PRIVATE_KEY");
if (!AGENT_PK) throw new Error("AGENT_PRIVATE_KEY not found (env or contracts/.env)");

const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
const canonical = (kind, p) => `PAP:${kind}:${JSON.stringify(sort(p))}`;

async function handshake(account, agentId) {
  const r1 = await fetch(BASE + PATH);
  const body = await r1.json();
  console.log(`  GET ${PATH} → ${r1.status} ${r1.headers.get("www-authenticate") ?? ""}`);
  if (r1.status !== 402) throw new Error("expected 402");
  const offer = body.accepts[0];
  console.log(`  accepts: scheme=${offer.scheme} network=${offer.network} passport=${offer.passport}`);

  const payload = { agentAddress: account.address, agentId, challenge: offer.challenge };
  const sig = await account.signMessage({ message: canonical("gate", payload) });
  const visa = Buffer.from(JSON.stringify({ ...payload, sig })).toString("base64");

  const r2 = await fetch(BASE + PATH, { headers: { "X-PAP-VISA": visa } });
  const out = await r2.json();
  console.log(`  GET ${PATH} + X-PAP-VISA → ${r2.status} ${JSON.stringify(out)}`);
  return r2.status;
}

console.log(`Gate: ${BASE}${PATH}`);
console.log(`\n[1] agent #${AGENT_ID} with its identity key`);
const ok = await handshake(privateKeyToAccount(AGENT_PK), AGENT_ID);

console.log(`\n[2] random key claiming agent #${AGENT_ID}`);
const bad = await handshake(privateKeyToAccount(generatePrivateKey()), AGENT_ID);

console.log(`\n[3] tampered challenge`);
const acct = privateKeyToAccount(AGENT_PK);
const p = { agentAddress: acct.address, agentId: AGENT_ID, challenge: "deadbeef.0000000000000000.00000000000000000000000000000000" };
const sig = await acct.signMessage({ message: canonical("gate", p) });
const r3 = await fetch(BASE + PATH, { headers: { "X-PAP-VISA": Buffer.from(JSON.stringify({ ...p, sig })).toString("base64") } });
console.log(`  → ${r3.status} ${JSON.stringify(await r3.json())}`);

const pass = ok === 200 && bad === 403 && r3.status === 403;
console.log(`\n${pass ? "PASS" : "FAIL"}: valid=${ok} random=${bad} tampered=${r3.status}`);
process.exit(pass ? 0 : 1);
