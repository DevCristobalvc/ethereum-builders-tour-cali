/**
 * JSON-RPC 2.0 conformance + parity with REST for /api/rpc (PAP-08).
 *   cd web && npx next dev -p 3055
 *   cd mcp && npx tsx scripts/rpc-test.ts [http://localhost:3055]
 */
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { canonical } from "../src/relay.ts";
import { blobHash, sealSecret, typedData, wire } from "../src/pap-core.ts";

const BASE = process.argv[2] ?? "http://localhost:3055";
const raw = async (body: string) => {
  const r = await fetch(`${BASE}/api/rpc`, { method: "POST", headers: { "content-type": "application/json" }, body });
  return { status: r.status, json: r.status === 204 ? null : await r.json() };
};
const rpc = async (method: string, params?: unknown, id: number | string = 1) => (await raw(JSON.stringify({ jsonrpc: "2.0", method, params, id }))).json;
const post = async (p: string, b: unknown) => (await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
let n = 0;
const check = (label: string, cond: boolean, extra?: unknown) => {
  assert.ok(cond, `${label} ${JSON.stringify(extra)}`);
  n++;
  console.log(`  ✓ ${label}`);
};

// conformance
let r = await raw("{not json");
check("parse error -32700", r.json.error.code === -32700 && r.json.id === null, r.json);
r = await raw(JSON.stringify({ method: "pap_chainId", id: 1 }));
check("missing jsonrpc → -32600", r.json.error.code === -32600, r.json);
check("unknown method → -32601", (await rpc("eth_sendTransaction")).error.code === -32601);
check("pap_chainId = 0x85 (133)", (await rpc("pap_chainId")).result === "0x85");
check("id echoed (string)", (await rpc("pap_chainId", undefined, "abc")).id === "abc");
r = await raw(JSON.stringify({ jsonrpc: "2.0", method: "pap_chainId" }));
check("notification → 204, no body", r.status === 204 && r.json === null, r);
r = await raw("[]");
check("empty batch → -32600", r.json.error.code === -32600, r.json);
r = await raw(JSON.stringify([{ jsonrpc: "2.0", method: "pap_chainId", id: 1 }, { jsonrpc: "2.0", method: "nope", id: 2 }, { jsonrpc: "2.0", method: "pap_chainId" }]));
check("mixed batch: 2 responses (notification dropped), ids kept", Array.isArray(r.json) && r.json.length === 2 && r.json[0].result === "0x85" && r.json[1].error.code === -32601, r.json);
check("invalid params → -32602", (await rpc("pap_getRequest", {})).error.code === -32602);
check("rpc.discover lists methods", (await rpc("rpc.discover")).result.methods.some((m: { name: string }) => m.name === "pap_requestSecret"));

// parity: a full secret flow through RPC
const agentPk = generatePrivateKey(), ownerPk = generatePrivateKey();
const agent = privateKeyToAccount(agentPk), owner = privateKeyToAccount(ownerPk);
const P = (await rpc("pap_contracts")).result.AgentPassport;
let p: Record<string, unknown> = { agentAddress: agent.address, agentName: "rpc-test" };
const pair = await post("/api/pair", { ...p, sig: await agent.signMessage({ message: canonical("pair", p) }) });
p = { pairId: pair.pairId, ownerAddress: owner.address, agentId: "9", txHash: "0xabc", status: "approved" };
await post(`/api/pair/${pair.pairId}/approve`, { ...p, sig: await owner.signMessage({ message: canonical("pair-approve", p) }) });
check("pap_getAgent", (await rpc("pap_getAgent", { address: agent.address })).result.ownerAddress === owner.address);
check("pap_getAgent unknown → -32001 (resource not found)", (await rpc("pap_getAgent", [{ address: owner.address }])).error.code === -32001);

const blob = await sealSecret("v", { name: "openai", agent: agent.address, agentPub: agent.publicKey, ownerPub: owner.publicKey });
const seal = { agent: agent.address, name: "openai", blobHash: blobHash(blob), maxReads: 1n, expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), nonce: `rpc${Math.random().toString(36).slice(2, 12)}` };
const sealed = await rpc("pap_sealSecret", { agentAddress: agent.address, name: "openai", blob, maxReads: "1", expiry: seal.expiry.toString(), nonce: seal.nonce, sig: await owner.signTypedData(typedData(P, "SealRequest", seal)) });
check("pap_sealSecret (owner) → active", sealed.result?.status === "active", sealed);
check("pap_listSecrets", (await rpc("pap_listSecrets", { agent: agent.address })).result[0].name === "openai");
const rv = { agent: agent.address, name: "openai", reason: "Run the RPC parity test suite", nonce: `rpc${Math.random().toString(36).slice(2, 12)}`, expiry: BigInt(Math.floor(Date.now() / 1000) + 300) };
const req = await rpc("pap_requestSecret", { agentAddress: agent.address, action: { type: "reveal", ...wire(rv) }, sig: await agent.signTypedData(typedData(P, "RevealRequest", rv)) });
check("pap_requestSecret → requestId", typeof req.result?.requestId === "string", req);
const replay = await rpc("pap_requestSecret", { agentAddress: agent.address, action: { type: "reveal", ...wire(rv) }, sig: await agent.signTypedData(typedData(P, "RevealRequest", rv)) });
check("nonce replay → -32000 with httpStatus 409", replay.error?.code === -32000 && replay.error.data.httpStatus === 409, replay);
check("pap_getRequest → pending", (await rpc("pap_getRequest", { id: req.result.requestId })).result.status === "pending");
const wrongType = await rpc("pap_requestTransfer", { agentAddress: agent.address, action: { type: "reveal" }, sig: "0x" });
check("pap_requestTransfer rejects non-transfer actions", wrongType.error?.code === -32602, wrongType);

console.log(`\n${n} checks passed`);
