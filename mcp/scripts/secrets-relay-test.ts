/**
 * Relay integration test for sealed secrets (PAP-02): pair → seal → phone approves → reveal →
 * phone peels + signs → agent opens. On-chain steps are skipped (tx hashes are placeholders):
 * this exercises the relay's checks, not HSK Chain.
 *
 *   cd web && npx next dev -p 3055        # no BLOB_READ_WRITE_TOKEN → in-memory store
 *   cd mcp && npx tsx scripts/secrets-relay-test.ts [http://localhost:3055]
 */
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { canonical } from "../src/relay.ts";
import { blobHash, openAgentLayer, peelOwnerLayer, sealSecret, typedData, wire } from "../src/pap-core.ts";

const BASE = process.argv[2] ?? "http://localhost:3055";
const post = async (path: string, body: unknown, method = "POST") => {
  const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return [r.status, await r.json()] as const;
};
const get = async (path: string) => {
  const r = await fetch(BASE + path);
  return [r.status, await r.json()] as const;
};
const msg = (a: PrivateKeyAccount, kind: string, p: unknown) => a.signMessage({ message: canonical(kind, p) });
const nonce = () => Math.random().toString(36).slice(2, 14);
const nowS = () => Math.floor(Date.now() / 1000);
let ok = 0;
const check = (label: string, cond: boolean, extra?: unknown) => {
  assert.ok(cond, `${label} ${extra ? JSON.stringify(extra) : ""}`);
  ok++;
  console.log(`  ✓ ${label}`);
};

const agentPk = generatePrivateKey();
const ownerPk = generatePrivateKey();
const agent = privateKeyToAccount(agentPk);
const owner = privateKeyToAccount(ownerPk);
const stranger = privateKeyToAccount(generatePrivateKey());
const { addresses } = (await get("/api/health"))[1];
const PASSPORT = addresses.AgentPassport;

console.log(`relay ${BASE} · agent ${agent.address} · owner ${owner.address}`);

// ── pair ──
let p: Record<string, unknown> = { agentAddress: agent.address, agentName: "secrets-test" };
let [s, r] = await post("/api/pair", { ...p, sig: await msg(agent, "pair", p) });
check("pair created", s === 200, r);
const pairId = r.pairId;
p = { pairId, ownerAddress: owner.address, agentId: "7", txHash: "0xabc", status: "approved" };
[s, r] = await post(`/api/pair/${pairId}/approve`, { ...p, sig: await msg(owner, "pair-approve", p) });
check("pair approved", s === 200 && r.status === "approved", r);
[, r] = await get(`/api/agents/${agent.address}`);
check("both public keys recorded at pairing", r.agentPublicKey === agent.publicKey && r.ownerPublicKey === owner.publicKey, r);

// ── seal (agent-side CLI) ──
const blob = await sealSecret("sk-live-TEST-123", { name: "openai", agent: agent.address, agentPub: r.agentPublicKey, ownerPub: r.ownerPublicKey });
const seal = { agent: agent.address, name: "openai", blobHash: blobHash(blob), maxReads: 2n, expiry: BigInt(nowS() + 86400), nonce: nonce() };
const sealBody = { agentAddress: agent.address, name: "openai", blob, maxReads: "2", expiry: seal.expiry.toString(), nonce: seal.nonce };
[s, r] = await post("/api/secrets", { ...sealBody, sig: await agent.signTypedData(typedData(PASSPORT, "SealRequest", seal)) });
check("seal accepted as pending, request for the phone", s === 200 && r.status === "pending" && r.requestId, r);
const sealReq = r.requestId;
[s] = await post("/api/secrets", { ...sealBody, sig: await agent.signTypedData(typedData(PASSPORT, "SealRequest", seal)) });
check("seal nonce replay → 409", s === 409);
const strangerSeal = { ...seal, nonce: nonce() };
[s] = await post("/api/secrets", { ...sealBody, nonce: strangerSeal.nonce, sig: await stranger.signTypedData(typedData(PASSPORT, "SealRequest", strangerSeal)) });
check("seal by a stranger → 401", s === 401);
const blobSwap = { ...seal, nonce: nonce() };
[s] = await post("/api/secrets", { ...sealBody, blob: blob + " ", nonce: blobSwap.nonce, sig: await agent.signTypedData(typedData(PASSPORT, "SealRequest", blobSwap)) });
check("seal with a blob that doesn't match the signed hash → 401", s === 401);
[, r] = await get(`/api/secrets?agent=${agent.address}`);
check("pending seal not listed yet", Array.isArray(r) && r.length === 0, r);

// reveal before activation
const early = { agent: agent.address, name: "openai", reason: "run the integration tests", nonce: nonce(), expiry: BigInt(nowS() + 300) };
[s] = await post("/api/requests", { agentAddress: agent.address, action: { type: "reveal", ...wire(early) }, sig: await agent.signTypedData(typedData(PASSPORT, "RevealRequest", early)) });
check("reveal before the phone approves the seal → 404", s === 404);

// phone approves the seal (grant tx placeholder)
p = { requestId: sealReq, status: "approved", txHash: "0x" + "11".repeat(32), reason: "" };
[s, r] = await post(`/api/requests/${sealReq}/resolve`, { ...p, sig: await msg(owner, "resolve", p) });
check("phone approves seal", s === 200 && r.status === "approved", r);
[, r] = await get(`/api/secrets?agent=${agent.address}`);
check("secret active, listed without blob", r.length === 1 && r[0].status === "active" && !("blob" in r[0]), r);

// ── reveal ──
const reveal = async (reason: string, n = nonce(), signer = agent) => {
  const m = { agent: agent.address, name: "openai", reason, nonce: n, expiry: BigInt(nowS() + 300) };
  return post("/api/requests", { agentAddress: agent.address, action: { type: "reveal", ...wire(m) }, sig: await signer.signTypedData(typedData(PASSPORT, "RevealRequest", m)) });
};
[s] = await reveal("short");
check("reason under 10 chars → 400", s === 400);
[s] = await reveal("run the integration tests", nonce(), stranger);
check("reveal signed by a stranger → 401", s === 401);
const n1 = nonce();
[s, r] = await reveal("run the integration tests", n1);
check("reveal request created", s === 200 && r.requestId, r);
const revealReq = r.requestId;
[s] = await reveal("run the integration tests", n1);
check("reveal nonce replay → 409", s === 409);

// phone: fetch blob, peel its layer, sign the approval
const [, req] = await get(`/api/requests/${revealReq}`);
check("phone sees reason + name", req.action.reason === "run the integration tests" && req.action.name === "openai", req);
const [, sec] = await get(`/api/secrets/${agent.address}/openai`);
const inner = await peelOwnerLayer(sec.blob, ownerPk, { name: "openai", agent: agent.address });
const approval = { requestId: revealReq, agent: agent.address, name: "openai", resultHash: blobHash(inner) };
p = { requestId: revealReq, status: "approved", txHash: "0x" + "22".repeat(32), reason: "" };
[s] = await post(`/api/requests/${revealReq}/resolve`, { ...p, result: inner, approvalSig: await stranger.signTypedData(typedData(PASSPORT, "RevealApproval", approval)), sig: await msg(owner, "resolve", p) });
check("approval signed by someone else → 401", s === 401);
[s] = await post(`/api/requests/${revealReq}/resolve`, { ...p, result: inner + "x", approvalSig: await owner.signTypedData(typedData(PASSPORT, "RevealApproval", approval)), sig: await msg(owner, "resolve", p) });
check("result that doesn't match the signed hash → 401", s === 401);
[s, r] = await post(`/api/requests/${revealReq}/resolve`, { ...p, result: inner, approvalSig: await owner.signTypedData(typedData(PASSPORT, "RevealApproval", approval)), sig: await msg(owner, "resolve", p) });
check("phone approves reveal", s === 200 && r.status === "approved", r);

// agent opens
const [, done] = await get(`/api/requests/${revealReq}`);
check("agent opens the secret with its key", (await openAgentLayer(done.result, agentPk, { name: "openai", agent: agent.address })) === "sk-live-TEST-123");
check("relay never stored the plaintext", !JSON.stringify(done).includes("sk-live") && !JSON.stringify(sec).includes("sk-live"));

// read limit (2) — second read OK, third blocked
[s, r] = await reveal("second read for the deploy");
p = { requestId: r.requestId, status: "rejected", txHash: "", reason: "no" };
[s, r] = await post(`/api/requests/${r.requestId}/resolve`, { ...p, sig: await msg(owner, "resolve", p) });
check("owner can reject a reveal", s === 200 && r.status === "rejected" && !r.result, r);

// ── revoke ──
p = { agentAddress: agent.address, name: "openai" };
[s] = await post(`/api/secrets/${agent.address}/openai`, { sig: await msg(stranger, "secret-revoke", p) }, "DELETE");
check("revoke by a stranger → 401", s === 401);
[s, r] = await post(`/api/secrets/${agent.address}/openai`, { sig: await msg(owner, "secret-revoke", p) }, "DELETE");
check("owner revokes", s === 200 && r.status === "revoked", r);
[s] = await reveal("run the integration tests again");
check("reveal after revoke → 404", s === 404);

// ── owner-signed seal (vault page) is active at once ──
const vault = { agent: agent.address, name: "stripe", blobHash: blobHash(blob), maxReads: 1n, expiry: BigInt(nowS() + 3600), nonce: nonce() };
[s, r] = await post("/api/secrets", { agentAddress: agent.address, name: "stripe", blob, maxReads: "1", expiry: vault.expiry.toString(), nonce: vault.nonce, sig: await owner.signTypedData(typedData(PASSPORT, "SealRequest", vault)) });
check("owner-signed seal is active immediately", s === 200 && r.status === "active", r);

// transfers still work as before
const action = { type: "transfer", token: addresses.DemoUSDT, to: owner.address, amount: "10", memo: "regression" };
p = { agentAddress: agent.address, action };
[s] = await post("/api/requests", { ...p, sig: await msg(agent, "request", p) });
check("transfer requests unchanged (regression)", s === 200);

console.log(`\n${ok} checks passed`);
