/**
 * Web Push (PAP-13): a fake push service receives what the relay sends when an agent asks for
 * something; we decrypt it (RFC 8291 aes128gcm) as the phone would and check the payload.
 *
 *   openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 1 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1
 *   cd web && NODE_EXTRA_CA_CERTS=cert.pem NEXT_PUBLIC_VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… npx next dev -p 3055
 *   cd mcp && PUSH_TEST_CERT=cert.pem PUSH_TEST_KEY=key.pem npx tsx scripts/push-test.ts [http://localhost:3055]
 */
import assert from "node:assert/strict";
import { createDecipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { canonical } from "../src/relay.ts";
import { typedData, wire } from "../src/pap-core.ts";

const BASE = process.argv[2] ?? "http://localhost:3055";
const post = async (p: string, b: unknown) => {
  const r = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  return [r.status, await r.json()] as const;
};
let n = 0;
const check = (label: string, cond: boolean, extra?: unknown) => {
  assert.ok(cond, `${label} ${JSON.stringify(extra)}`);
  n++;
  console.log(`  ✓ ${label}`);
};
const b64u = (b: Buffer) => b.toString("base64url");

// the "phone" browser's push keys
const ua = createECDH("prime256v1");
ua.generateKeys();
const auth = randomBytes(16);

function decrypt(body: Buffer) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return JSON.parse(pt.subarray(0, pt.lastIndexOf(2)).toString("utf8"));
}

const received: { headers: Record<string, unknown>; payload: { title: string; body: string; url: string } }[] = [];
let gone = false;
// web-push only speaks HTTPS: the fake push service uses a local cert that the relay trusts via
// NODE_EXTRA_CA_CERTS (PUSH_TEST_CERT / PUSH_TEST_KEY point at it).
const tls = { cert: readFileSync(process.env.PUSH_TEST_CERT!), key: readFileSync(process.env.PUSH_TEST_KEY!) };
const svc = createServer(tls, async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (gone) return res.writeHead(410).end();
  received.push({ headers: req.headers, payload: decrypt(Buffer.concat(chunks)) });
  res.writeHead(201).end();
});
await new Promise<void>((r) => svc.listen(8597, "127.0.0.1", r));
const endpoint = "https://127.0.0.1:8597/push/device-1";
const subscription = { endpoint, keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } };

const agentPk = generatePrivateKey(), ownerPk = generatePrivateKey();
const agent = privateKeyToAccount(agentPk), owner = privateKeyToAccount(ownerPk);
let p: Record<string, unknown> = { agentAddress: agent.address, agentName: "push-test agent" };
const [, pair] = await post("/api/pair", { ...p, sig: await agent.signMessage({ message: canonical("pair", p) }) });
p = { pairId: pair.pairId, ownerAddress: owner.address, agentId: "3", txHash: "0xabc", status: "approved" };
await post(`/api/pair/${pair.pairId}/approve`, { ...p, sig: await owner.signMessage({ message: canonical("pair-approve", p) }) });

let [s] = await post("/api/push/subscribe", { owner: owner.address, subscription, sig: await agent.signMessage({ message: canonical("push-subscribe", { owner: owner.address, endpoint }) }) });
check("subscribe signed by someone else → 401", s === 401);
let r;
[s, r] = await post("/api/push/subscribe", { owner: owner.address, subscription, sig: await owner.signMessage({ message: canonical("push-subscribe", { owner: owner.address, endpoint }) }) });
check("owner subscribes the phone", s === 200 && r.devices === 1, r);

const wait = async (count: number) => {
  for (let i = 0; i < 50 && received.length < count; i++) await new Promise((res) => setTimeout(res, 100));
};
const P = (await (await fetch(`${BASE}/api/health`)).json()).addresses;
const action = { type: "transfer", token: P.DemoUSDT, to: owner.address, amount: "7", memo: "dataset for maria" };
p = { agentAddress: agent.address, action };
[, r] = await post("/api/requests", { ...p, sig: await agent.signMessage({ message: canonical("request", p) }) });
await wait(1);
check("a transfer request pushes to the phone", received.length === 1, received);
check("VAPID-signed, aes128gcm-encrypted, urgent", String(received[0].headers.authorization).startsWith("vapid ") && received[0].headers["content-encoding"] === "aes128gcm" && received[0].headers.urgency === "high", received[0].headers);
check("tap opens the approval page", received[0].payload.url === `/approve/${r.requestId}`, received[0].payload);
check("payload has agent + action type only (no amount, memo or address)", received[0].payload.body === "push-test agent wants to make a payment" && !JSON.stringify(received[0].payload).includes("maria"), received[0].payload);

// secret request → push without the secret's name or reason
const rv = { agent: agent.address, name: "openai", reason: "Rotate the production database password", nonce: Math.random().toString(36).slice(2, 12), expiry: BigInt(Math.floor(Date.now() / 1000) + 300) };
// needs an active secret: owner-signed seal
const { sealSecret, blobHash } = await import("../src/pap-core.ts");
const blob = await sealSecret("x", { name: "openai", agent: agent.address, agentPub: agent.publicKey, ownerPub: owner.publicKey });
const seal = { agent: agent.address, name: "openai", blobHash: blobHash(blob), maxReads: 3n, expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), nonce: Math.random().toString(36).slice(2, 12) };
await post("/api/secrets", { agentAddress: agent.address, name: "openai", blob, maxReads: "3", expiry: seal.expiry.toString(), nonce: seal.nonce, sig: await owner.signTypedData(typedData(P.AgentPassport, "SealRequest", seal)) });
[s] = await post("/api/requests", { agentAddress: agent.address, action: { type: "reveal", ...wire(rv) }, sig: await agent.signTypedData(typedData(P.AgentPassport, "RevealRequest", rv)) });
await wait(2);
check("a secret request pushes too", s === 200 && received.length === 2);
check("…without the secret name or the reason", received[1].payload.body === "push-test agent wants to read a secret" && !/openai|database/.test(JSON.stringify(received[1].payload)), received[1].payload);

// expired subscription (410) is dropped; the relay keeps working
gone = true;
[s] = await post("/api/requests", { ...p, sig: await agent.signMessage({ message: canonical("request", p) }) });
await new Promise((res) => setTimeout(res, 1500));
check("request still created when the push service says 410", s === 200);
gone = false;
[s] = await post("/api/requests", { ...p, sig: await agent.signMessage({ message: canonical("request", p) }) });
await new Promise((res) => setTimeout(res, 1500));
check("dead subscription removed (no more pushes to it)", s === 200 && received.length === 2, received.length);

svc.close();
console.log(`\n${n} checks passed`);
