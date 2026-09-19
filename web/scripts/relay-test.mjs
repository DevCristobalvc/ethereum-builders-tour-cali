import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
const BASE = "http://localhost:3055";
const canonical = (kind, p) => `PAP:${kind}:${JSON.stringify(sort(p))}`;
const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
const post = async (path, body) => { const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return [r.status, await r.json()]; };
const get = async (path) => (await fetch(BASE + path)).json();

const agent = privateKeyToAccount(generatePrivateKey());
const owner = privateKeyToAccount(generatePrivateKey());
const t0 = Date.now();

let p = { agentAddress: agent.address, agentName: "claude-code-test" };
let [s, r] = await post("/api/pair", { ...p, sig: await agent.signMessage({ message: canonical("pair", p) }) });
console.log("pair", s, r.pairId, r.url);
const pairId = r.pairId;

// bad sig rejected
[s] = await post(`/api/pair/${pairId}/approve`, { ownerAddress: owner.address, agentId: "1", txHash: "", status: "approved", sig: "0x" + "11".repeat(65) });
console.log("approve bad sig ->", s);

p = { pairId, ownerAddress: owner.address, agentId: "7", txHash: "0xabc", status: "approved" };
[s, r] = await post(`/api/pair/${pairId}/approve`, { ...p, sig: await owner.signMessage({ message: canonical("pair-approve", p) }) });
console.log("approve", s, r.status, r.agentId);
console.log("agent rec", (await get(`/api/agents/${agent.address}`)).ownerAddress === owner.address);

const action = { type: "transfer", token: "0xdD8FB4B51aa492b9E0Ae5AD10de65B146797Cd84", to: owner.address, amount: "10", memo: "test" };
p = { agentAddress: agent.address, action };
[s, r] = await post("/api/requests", { ...p, sig: await agent.signMessage({ message: canonical("request", p) }) });
console.log("request", s, r.requestId);
const reqId = r.requestId;
console.log("pending list", (await get(`/api/requests?owner=${owner.address}`)).length);

p = { requestId: reqId, status: "approved", txHash: "0xdeadbeef", reason: "" };
[s, r] = await post(`/api/requests/${reqId}/resolve`, { ...p, sig: await owner.signMessage({ message: canonical("resolve", p) }) });
console.log("resolve", s, r.status, r.txHash);
console.log("get", (await get(`/api/requests/${reqId}`)).status);
[s] = await post(`/api/requests/${reqId}/resolve`, { ...p, sig: await owner.signMessage({ message: canonical("resolve", p) }) });
console.log("double resolve ->", s);
console.log("total ms", Date.now() - t0);
