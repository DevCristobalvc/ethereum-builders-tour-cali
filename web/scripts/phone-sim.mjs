/**
 * Headless "phone": does exactly what the PWA does, with a raw private key instead
 * of a passkey. Used to test the whole protocol end-to-end without an iPhone.
 *
 *   node scripts/phone-sim.mjs pair <pairId>       # onboard the agent (4 txs) and approve pairing
 *   node scripts/phone-sim.mjs approve <requestId> # transfer: pay() · seal: grant() · reveal: peel + record()
 *   node scripts/phone-sim.mjs reject <requestId>
 *
 * Env: PHONE_PRIVATE_KEY (defaults to TEST_PRIVATE_KEY from .env.local), PAP_RELAY_URL,
 *      PAP_SIM_NO_CHAIN=1 to skip the on-chain txs (relay-only runs against a local dev server)
 */
import { existsSync, readFileSync } from "node:fs";
import { concatHex, createPublicClient, createWalletClient, http, keccak256, maxUint256, parseEventLogs, parseUnits, stringToHex, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { blobHash, peelOwnerLayer, revealRef, secretScope, typedData } from "../src/lib/pap-core.ts";

const envFile = new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  (existsSync(envFile) ? readFileSync(envFile, "utf8") : "")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const [k, v] = l.split(/=(.*)/s); return [k, v.trim().replace(/^"(.*)"$/, "$1")]; })
);
const RELAY = process.env.PAP_RELAY_URL ?? "https://pap.devcristobalvc.com";
const PK = process.env.PHONE_PRIVATE_KEY ?? env.TEST_PRIVATE_KEY;
const abis = JSON.parse(readFileSync(new URL("../src/generated/abis.json", import.meta.url), "utf8"));

const chain = { id: 133, name: "HSK Testnet", nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 }, rpcUrls: { default: { http: ["https://testnet.hsk.xyz"] } } };
const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ account, chain, transport: http() });

const canonical = (kind, p) => `PAP:${kind}:${JSON.stringify(sort(p))}`;
const sort = (v) => (Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v);
const api = async (path, body) => {
  const r = await fetch(RELAY + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const d = await r.json();
  if (!r.ok) throw new Error(`${path}: ${d.error}`);
  return d;
};
const NO_CHAIN = Boolean(process.env.PAP_SIM_NO_CHAIN);
const tx = async (label, req) => {
  if (NO_CHAIN) {
    console.log(`  (skipped on-chain) ${label}`);
    return { transactionHash: `0x${"00".repeat(32)}`, logs: [] };
  }
  const hash = await wallet.writeContract(req);
  const rc = await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${rc.status === "success" ? "✓" : "✗"} ${label}  ${hash}`);
  if (rc.status !== "success") throw new Error(`${label} reverted`);
  return rc;
};

const [cmd, id] = process.argv.slice(2);
const { addresses: A } = await api("/api/health");
console.log(`phone = ${account.address} · relay ${RELAY}`);

if (cmd === "pair") {
  const pair = await api(`/api/pair/${id}`);
  console.log(`pairing ${pair.agentName} (${pair.agentAddress}) status=${pair.status}`);
  const agentURI = `${RELAY}/api/agents/${pair.agentAddress}/card`;
  const regRc = await tx("register (ERC-8004)", { address: A.IdentityRegistry, abi: abis.IdentityRegistry, functionName: "register", args: [agentURI, pair.agentAddress] });
  const regHash = regRc.transactionHash;
  // Read the id from the event, not from a follow-up eth_call (load-balanced RPC may lag a block).
  const [reg] = parseEventLogs({ abi: abis.IdentityRegistry, eventName: "Registered", logs: regRc.logs });
  const agentId = reg?.args.agentId ?? 1n; // 1n only in PAP_SIM_NO_CHAIN runs
  console.log(`  agentId #${agentId}`);
  await tx("faucet demoUSDT", { address: A.DemoUSDT, abi: abis.DemoUSDT, functionName: "faucet", args: [] });
  await tx("approve passport", { address: A.DemoUSDT, abi: abis.DemoUSDT, functionName: "approve", args: [A.AgentPassport, maxUint256] });
  const scope = keccak256(concatHex([stringToHex("transfer:"), A.DemoUSDT])); // abi.encodePacked("transfer:", token)
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
  await tx("grant visa 100 demoUSDT / 7d", { address: A.AgentPassport, abi: abis.AgentPassport, functionName: "grant", args: [agentId, scope, parseUnits("100", 6), expiry] });
  const payload = { pairId: id, ownerAddress: account.address, agentId: agentId.toString(), txHash: regHash, status: "approved" };
  const sig = await account.signMessage({ message: canonical("pair-approve", payload) });
  const res = await api(`/api/pair/${id}/approve`, { ...payload, sig });
  console.log(`paired → agentId #${res.agentId}`);
} else if (cmd === "approve" || cmd === "reject") {
  const req = await api(`/api/requests/${id}`);
  const a = req.action;
  const what = a.type === "transfer" ? `${a.amount} demoUSDT → ${a.to}` : a.type === "reveal" ? `read secret "${a.name}" — "${a.reason}"` : `store secret "${a.name}" (${a.maxReads} reads)`;
  console.log(`request: ${req.agentName} wants to ${what} (status ${req.status})`);
  let txHash = "";
  const extra = {};
  if (cmd === "approve") {
    const agentId = BigInt(req.agentId);
    if (a.type === "transfer") {
      const ref = keccak256(toBytes(`pap:req:${id}`));
      txHash = (await tx("AgentPassport.pay", { address: A.AgentPassport, abi: abis.AgentPassport, functionName: "pay", args: [agentId, a.token, a.to, parseUnits(a.amount, 6), ref] })).transactionHash;
    } else if (a.type === "seal") {
      txHash = (await tx(`grant visa secret:${a.name}`, { address: A.AgentPassport, abi: abis.AgentPassport, functionName: "grant", args: [agentId, secretScope(a.name), BigInt(a.maxReads), BigInt(a.expiry)] })).transactionHash;
    } else {
      const secret = await api(`/api/secrets/${req.agentAddress}/${a.name}`);
      const inner = await peelOwnerLayer(secret.blob, PK, { name: a.name, agent: req.agentAddress });
      console.log("  ✓ peeled the owner layer (value still encrypted to the agent)");
      txHash = (await tx("AgentPassport.record (1 read)", { address: A.AgentPassport, abi: abis.AgentPassport, functionName: "record", args: [agentId, secretScope(a.name), 1n, revealRef(id)] })).transactionHash;
      extra.result = inner;
      extra.approvalSig = await account.signTypedData(typedData(A.AgentPassport, "RevealApproval", { requestId: id, agent: req.agentAddress, name: a.name, resultHash: blobHash(inner) }));
    }
  }
  const payload = { requestId: id, status: cmd === "approve" ? "approved" : "rejected", txHash, reason: cmd === "reject" ? "rejected by owner (sim)" : "" };
  const sig = await account.signMessage({ message: canonical("resolve", payload) });
  const res = await api(`/api/requests/${id}/resolve`, { ...payload, ...extra, sig });
  console.log(`resolved → ${res.status}${res.txHash ? ` ${res.txHash}` : ""}`);
} else {
  console.log("usage: phone-sim.mjs pair <pairId> | approve <requestId> | reject <requestId>");
  process.exit(1);
}
