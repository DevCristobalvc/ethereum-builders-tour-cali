/**
 * `pap rpc` (PAP-09/10/11) end-to-end with the real CLI bundle: viem talks to the local signer,
 * reads go to a fake HSK node, transactions and secrets go through a headless phone.
 *
 *   cd web && npx next dev -p 3055
 *   cd mcp && PAP_RELAY_URL=http://localhost:3055 npx tsx scripts/rpc-signer-test.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const RELAY = process.env.PAP_RELAY_URL ?? "http://localhost:3055";
const PORT = 8599;
const LOCAL = `http://127.0.0.1:${PORT}`;
let n = 0;
const check = (label, cond, extra = "") => {
  if (!cond) throw new Error(`✗ ${label} ${typeof extra === "string" ? extra : JSON.stringify(extra)}`);
  n++;
  console.log(`✓ ${label}`);
};
const canonical = (kind, p) => `PAP:${kind}:${JSON.stringify(sort(p))}`;
const sort = (v) => (Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v);
const post = async (p, b) => (await fetch(RELAY + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const get = async (p) => (await fetch(RELAY + p)).json();

// ── fake HSK node: records what gets forwarded ──
const forwarded = [];
const fake = createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  const { method, id } = JSON.parse(body);
  forwarded.push(method);
  const result = { eth_chainId: "0x85", eth_blockNumber: "0x2a", eth_getBalance: "0x0", eth_call: "0x" + "0".repeat(64) }[method] ?? null;
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id, result }));
});
await new Promise((r) => fake.listen(8598, "127.0.0.1", r));

// ── agent identity paired with a fresh owner ──
const agentPk = generatePrivateKey();
const ownerPk = generatePrivateKey();
const agent = privateKeyToAccount(agentPk);
const owner = privateKeyToAccount(ownerPk);
let p = { agentAddress: agent.address, agentName: "rpc-signer-test" };
const pair = await post("/api/pair", { ...p, sig: await agent.signMessage({ message: canonical("pair", p) }) });
p = { pairId: pair.pairId, ownerAddress: owner.address, agentId: "5", txHash: "0xabc", status: "approved" };
await post(`/api/pair/${pair.pairId}/approve`, { ...p, sig: await owner.signMessage({ message: canonical("pair-approve", p) }) });
const PAP_HOME = mkdtempSync(join(tmpdir(), "pap-rpc-"));
writeFileSync(join(PAP_HOME, "agent.json"), JSON.stringify({ privateKey: agentPk, address: agent.address, name: "rpc-signer-test", relay: RELAY, ownerAddress: owner.address, agentId: "5", contacts: {} }));

const env = { ...process.env, PAP_HOME, PAP_RELAY_URL: RELAY, PAP_RPC_URL: "http://127.0.0.1:8598", PAP_NO_BROWSER: "1", PAP_WAIT_MS: "30000", PAP_SIM_NO_CHAIN: "1", PHONE_PRIVATE_KEY: ownerPk };
const rpcProc = spawn("node", ["dist/pap-cli.mjs", "rpc", "--port", String(PORT)], { env, stdio: ["ignore", "inherit", "pipe"] });
let rpcLog = "";
rpcProc.stderr.on("data", (d) => (rpcLog += d));
for (let i = 0; i < 50 && !rpcLog.includes("listening"); i++) await new Promise((r) => setTimeout(r, 100));
check("pap rpc starts on 127.0.0.1", rpcLog.includes(`listening on ${LOCAL}`), rpcLog);

// headless phone: resolves every pending request of this owner as told
let phoneMode = "approve";
const handled = new Set();
const phoneLoop = setInterval(async () => {
  const reqs = await get(`/api/requests?owner=${owner.address}`).catch(() => []);
  for (const r of reqs.filter((r) => r.status === "pending" && !handled.has(r.id))) {
    handled.add(r.id);
    execFileSync("node", ["--no-warnings", "../web/scripts/phone-sim.mjs", phoneMode, r.id], { env, stdio: "ignore" });
  }
}, 400);

const raw = async (method, params = []) => (await (await fetch(LOCAL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json());
const publicClient = createPublicClient({ transport: http(LOCAL) });
const wallet = createWalletClient({ account: agent.address, transport: http(LOCAL, { timeout: 60_000 }) });
const TOKEN = (await get("/api/health")).addresses.DemoUSDT;

// reads
check("eth_chainId forwarded to HSK (0x85)", (await publicClient.getChainId()) === 133 && forwarded.includes("eth_chainId"));
check("eth_blockNumber forwarded", (await publicClient.getBlockNumber()) === 42n);
check("eth_accounts = the agent", (await wallet.getAddresses())[0] === agent.address);

// ERC-20 transfer through the phone (agent has no gas → phone path)
const est = await raw("eth_estimateGas", [{ from: agent.address, to: TOKEN, data: "0xa9059cbb" + owner.address.slice(2).padStart(64, "0") + "1".padStart(64, "0") }]);
check("eth_estimateGas of a brokered transfer answered locally (no upstream revert)", est.result === "0x30d40" && !forwarded.includes("eth_estimateGas"), est);
const hash = await wallet.writeContract({ address: TOKEN, abi: erc20Abi, functionName: "transfer", args: [owner.address, parseUnits("3", 6)], chain: null });
check("viem writeContract(transfer) → approved on the phone → tx hash", /^0x[0-9a-f]{64}$/.test(hash), hash);
const lastReq = (await get(`/api/requests?owner=${owner.address}`))[0];
check("relay got a PAP transfer of 3 demoUSDT", lastReq.action.type === "transfer" && lastReq.action.amount === "3" && lastReq.status === "approved", lastReq);

phoneMode = "reject";
let err = await wallet.writeContract({ address: TOKEN, abi: erc20Abi, functionName: "transfer", args: [owner.address, 1n], chain: null, gas: 100000n }).catch((e) => e);
check("phone rejection → EIP-1193 4001 (viem UserRejectedRequestError)", err?.name === "UserRejectedRequestError" || err?.cause?.code === 4001 || /rejected/i.test(err?.message), err?.message);
phoneMode = "approve";

let r = await raw("eth_sendTransaction", [{ from: agent.address, to: TOKEN, data: "0xdeadbeef" }]);
check("arbitrary calldata is refused, never signed (4200)", r.error?.code === 4200, r);
r = await raw("eth_sendTransaction", [{ from: owner.address, to: TOKEN, data: "0x" }]);
check("other `from` accounts → 4100 unauthorized", r.error?.code === 4100, r);
r = await raw("eth_signTransaction", []);
check("unknown methods → 4200", r.error?.code === 4200, r);
r = await raw("personal_sign", ["0x68656c6c6f", agent.address]);
check("personal_sign with the agent identity", typeof r.result === "string" && r.result.length === 132, r);

// secrets via eth_getEncryptionPublicKey / eth_decrypt
r = await raw("eth_getEncryptionPublicKey", [agent.address]);
check("eth_getEncryptionPublicKey = compressed agent key", r.result?.length === 68, r);
const { sealSecret, blobHash, typedData } = await import("../src/pap-core.ts");
const blob = await sealSecret("sk-rpc-SECRET", { name: "openai", agent: agent.address, agentPub: agent.publicKey, ownerPub: owner.publicKey });
const seal = { agent: agent.address, name: "openai", blobHash: blobHash(blob), maxReads: 5n, expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), nonce: Math.random().toString(36).slice(2, 14) };
const P = (await get("/api/health")).addresses.AgentPassport;
await post("/api/secrets", { agentAddress: agent.address, name: "openai", blob, maxReads: "5", expiry: seal.expiry.toString(), nonce: seal.nonce, sig: await owner.signTypedData(typedData(P, "SealRequest", seal)) });
r = await raw("eth_decrypt", ["pap:secret:openai", agent.address]);
check('eth_decrypt("pap:secret:openai") → phone approves → plaintext', r.result === "sk-rpc-SECRET", r);
r = await raw("eth_decrypt", [JSON.stringify({ version: "x25519-xsalsa20-poly1305", nonce: "", ephemPublicKey: "", ciphertext: "" }), agent.address]);
check("MetaMask x25519 blobs → clear 4200", r.error?.code === 4200, r);

// wallet_*
r = await raw("wallet_getCapabilities", [agent.address]);
check("wallet_getCapabilities announces pap (secrets, visas, gate)", r.result?.["0x85"]?.pap?.secrets?.supported === true, r);
r = await raw("wallet_grantPermissions", [{ permissions: [{ type: "erc20-token-allowance", data: { token: TOKEN, allowance: "0x1" } }], expiry: 1 }]);
check("wallet_grantPermissions (EIP-7715 subset) → needs-owner when no visa", r.result?.pap?.status === "needs-owner", r);
r = await raw("wallet_sendCalls", [{ version: "2.0.0", from: agent.address, chainId: "0x85", atomicRequired: false, calls: [
  { to: TOKEN, data: "0xa9059cbb" + owner.address.slice(2).padStart(64, "0") + (1_000_000).toString(16).padStart(64, "0") },
  { to: TOKEN, data: "0xa9059cbb" + owner.address.slice(2).padStart(64, "0") + (2_000_000).toString(16).padStart(64, "0") },
] }]);
check("wallet_sendCalls → bundle id", /^0x[0-9a-f]{64}$/.test(r.result?.id ?? ""), r);
let st;
for (let i = 0; i < 60; i++) {
  st = (await raw("wallet_getCallsStatus", [r.result.id])).result;
  if (st.status !== 100) break;
  await new Promise((res) => setTimeout(res, 500));
}
check("wallet_getCallsStatus → 200 with 2 receipts (2 phone approvals)", st.status === 200 && st.receipts.length === 2, st);
r = await raw("wallet_sendCalls", [{ calls: [{ to: TOKEN, data: "0x" }], atomicRequired: true }]);
check("atomicRequired → 5760 (not supported)", r.error?.code === 5760, r);

clearInterval(phoneLoop);
rpcProc.kill();
fake.close();
console.log(`\n${n} checks passed`);
process.exit(0);
