// scratch: seed the local relay and screenshot the phone screens (not committed)
import { chromium } from "/tmp/claude-0/-home-user-ethereum-builders-tour-cali/8e42e19a-5fa0-5755-9e53-4f757f3b6f19/scratchpad/pw/node_modules/playwright/index.mjs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { canonical } from "../src/relay.ts";
import { blobHash, sealSecret, typedData, wire } from "../src/pap-core.ts";
const BASE = "http://localhost:3055";
const OUT = process.argv[2];
const post = async (p: string, b: unknown) => (await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const get = async (p: string) => (await fetch(BASE + p)).json();
const agentPk = generatePrivateKey(), ownerPk = generatePrivateKey();
const agent = privateKeyToAccount(agentPk), owner = privateKeyToAccount(ownerPk);
const { addresses } = await get("/api/health");
const P = addresses.AgentPassport;
let p: any = { agentAddress: agent.address, agentName: "Claude Code @ laptop" };
const pr = await post("/api/pair", { ...p, sig: await agent.signMessage({ message: canonical("pair", p) }) });
p = { pairId: pr.pairId, ownerAddress: owner.address, agentId: "4", txHash: "0xabc", status: "approved" };
await post(`/api/pair/${pr.pairId}/approve`, { ...p, sig: await owner.signMessage({ message: canonical("pair-approve", p) }) });
for (const name of ["openai", "stripe"]) {
  const blob = await sealSecret("x", { name, agent: agent.address, agentPub: agent.publicKey, ownerPub: owner.publicKey });
  const m = { agent: agent.address, name, blobHash: blobHash(blob), maxReads: 10n, expiry: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400), nonce: Math.random().toString(36).slice(2, 12) };
  await post("/api/secrets", { agentAddress: agent.address, name, blob, maxReads: "10", expiry: m.expiry.toString(), nonce: m.nonce, sig: await owner.signTypedData(typedData(P, "SealRequest", m)) });
}
const rm = { agent: agent.address, name: "openai", reason: "Run the integration tests that call the OpenAI API", nonce: Math.random().toString(36).slice(2, 12), expiry: BigInt(Math.floor(Date.now() / 1000) + 600) };
const rr = await post("/api/requests", { agentAddress: agent.address, action: { type: "reveal", ...wire(rm) }, sig: await agent.signTypedData(typedData(P, "RevealRequest", rm)) });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((w) => localStorage.setItem("pap.wallet.v1", JSON.stringify(w)), { address: owner.address, credentialId: "AA", prf: false, pk: ownerPk, createdAt: Date.now() });
const page = await ctx.newPage();
const shot = async (url: string, name: string, click?: string) => {
  await page.goto(BASE + url);
  if (click) await page.getByRole("button", { name: click }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};
await shot(`/approve/${rr.requestId}`, "approve-reveal");
await shot("/wallet", "wallet-agents");
await shot("/wallet", "wallet-vault", "🔑 Vault");
await shot("/wallet", "wallet-stamps", "🛂 Stamps");
await shot("/vault/new", "vault-new");
await b.close();
console.log("ok");
