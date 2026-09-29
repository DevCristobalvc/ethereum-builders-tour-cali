/**
 * `pap rpc` — a local Ethereum JSON-RPC endpoint (EIP-1193 semantics) backed by PAP.
 * Point any tool at it (`cast --rpc-url http://127.0.0.1:8545`, viem `http()`, ethers
 * JsonRpcProvider, web3.py) and it works without a private key in `.env`:
 *
 *  - reads (eth_call, eth_getBalance, …) are forwarded to HSK Chain;
 *  - eth_accounts → the agent's address (an identity key that holds no funds);
 *  - eth_sendTransaction of an ERC-20 `transfer(to, amount)` becomes a PAP payment from the
 *    human's wallet: signed by the agent alone if its visa covers it and it has gas, otherwise
 *    approved on the human's phone (Face ID). Calls to AgentPassport are signed by the agent and
 *    enforced by the contract. Anything else is refused (never signed silently);
 *  - eth_getEncryptionPublicKey / eth_decrypt: sealed secrets with the double signature;
 *  - wallet_getCapabilities / wallet_grantPermissions / wallet_sendCalls: see handlers below.
 *
 * Listens on 127.0.0.1 only.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createWalletClient,
  decodeFunctionData,
  encodeFunctionData,
  formatUnits,
  http,
  isAddress,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { addresses, hskTestnet, pub, transferScope } from "./chain.js";
import { account, type Identity } from "./identity.js";
import { call, openBrowser, sign, waitFor, type RequestState } from "./relay.js";
import { publicKeyOf } from "./pap-core.js";
import { awaitReveal, ExpiredError, RejectedError, requestReveal } from "./secrets.js";

export const UPSTREAM = () => process.env.PAP_RPC_URL ?? "https://testnet.hsk.xyz";
const WAIT_MS = () => Number(process.env.PAP_WAIT_MS ?? 5 * 60_000);

/** Read-only methods forwarded verbatim to HSK Chain. */
const PASSTHROUGH = new Set([
  "eth_chainId",
  "net_version",
  "web3_clientVersion",
  "eth_blockNumber",
  "eth_call",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getTransactionCount",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getLogs",
  "eth_syncing",
  "eth_sendRawTransaction", // already signed elsewhere: PAP adds nothing, just relays
]);

const erc20 = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);
const passportAbi = parseAbi([
  "function pay(uint256 agentId, address token, address to, uint256 amount, bytes32 ref)",
  "function record(uint256 agentId, bytes32 scope, uint256 amount, bytes32 ref)",
  "function canAct(uint256 agentId, bytes32 scope, uint256 amount) view returns (bool)",
]);

export class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
  }
}
const rejected = (m = "User rejected the request.") => new RpcError(4001, m);
const unsupported = (m: string) => new RpcError(4200, m);
const unauthorized = (m: string) => new RpcError(4100, m);

type Tx = { from?: Address; to?: Address; data?: Hex; value?: Hex; gas?: Hex };
type Log = (line: string) => void;

export type Ctx = { id: Identity; log: Log };

async function upstream(method: string, params: unknown) {
  const res = await fetch(UPSTREAM(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
  });
  const j = (await res.json()) as { result?: unknown; error?: { code: number; message: string; data?: unknown } };
  if (j.error) throw new RpcError(j.error.code, j.error.message, j.error.data);
  return j.result;
}

function mustBeAgent(id: Identity, from?: string) {
  if (from && from.toLowerCase() !== id.address.toLowerCase())
    throw unauthorized(`Only the agent account ${id.address} is available on this endpoint.`);
}

/** Ask the human's phone to approve a transfer; returns the tx hash of AgentPassport.pay. */
async function phoneTransfer(ctx: Ctx, token: Address, to: Address, amount: string, memo: string): Promise<Hex> {
  const { id } = ctx;
  const payload = { agentAddress: id.address, action: { type: "transfer", token, to, amount, memo } };
  const r = await call<{ requestId: string; url: string; showUrl: string }>(id, "/api/requests", {
    method: "POST",
    body: JSON.stringify({ ...payload, sig: await sign(id, "request", payload) }),
  });
  ctx.log(`waiting for approval on the phone: ${r.url}`);
  openBrowser(r.showUrl);
  const st = await waitFor<RequestState>(id, `/api/requests/${r.requestId}`, WAIT_MS());
  if (st?.status === "approved" && st.txHash) return st.txHash;
  if (st?.status === "rejected") throw rejected(`Rejected on the phone${st.reason ? ` (${st.reason})` : ""}.`);
  throw new RpcError(4900, st?.status === "expired" ? "Request expired without a decision." : "Timed out waiting for the phone.");
}

/** Agent-signed tx (identity key) — only used where AgentPassport enforces the visa on-chain. */
async function agentSend(ctx: Ctx, to: Address, data: Hex): Promise<Hex> {
  const client = createWalletClient({ account: account(ctx.id), chain: hskTestnet, transport: http(UPSTREAM()) });
  return client.sendTransaction({ to, data });
}

async function sendTransaction(ctx: Ctx, tx: Tx): Promise<Hex> {
  const { id } = ctx;
  mustBeAgent(id, tx.from);
  if (!id.agentId || !id.ownerAddress) throw unauthorized("Agent not paired: run pap_connect first.");
  if (!tx.to || !tx.data) throw unsupported("Only contract calls are supported (plain value transfers are not brokered).");
  if (tx.value && BigInt(tx.value) > 0n) throw unsupported("Sending native value is not supported through PAP.");
  const a = await addresses(id);
  const agentId = BigInt(id.agentId);

  // Direct calls to AgentPassport (pay / record): the contract enforces the visa.
  if (a.AgentPassport && tx.to.toLowerCase() === a.AgentPassport.toLowerCase()) {
    const fn = decodeFunctionData({ abi: passportAbi, data: tx.data }).functionName;
    if (fn !== "pay" && fn !== "record") throw unsupported(`AgentPassport.${fn} is owner-only.`);
    ctx.log(`agent signs AgentPassport.${fn} (visa enforced on-chain)`);
    return agentSend(ctx, tx.to, tx.data);
  }

  // ERC-20 transfer(to, amount) → a PAP payment from the human's wallet.
  let decoded;
  try {
    decoded = decodeFunctionData({ abi: erc20, data: tx.data });
  } catch {
    throw unsupported("PAP only brokers ERC-20 transfer(to, amount) and AgentPassport calls; this transaction was not signed.");
  }
  const [to, amount] = decoded.args as [Address, bigint];
  const token = tx.to;
  const decimals = a.DemoUSDT && token.toLowerCase() === a.DemoUSDT.toLowerCase() ? 6 : 18;
  const human = formatUnits(amount, decimals);

  // Autonomous path: visa covers it and the agent key has gas.
  if (a.AgentPassport) {
    const [covered, gas] = await Promise.all([
      pub.readContract({ address: a.AgentPassport, abi: passportAbi, functionName: "canAct", args: [agentId, transferScope(token), amount] }).catch(() => false),
      pub.getBalance({ address: id.address }).catch(() => 0n),
    ]);
    if (covered && gas > 0n) {
      ctx.log(`visa covers ${human} → agent pays alone via AgentPassport.pay`);
      const ref = keccak256(stringToHex(`pap:rpc:${Date.now()}`));
      return agentSend(ctx, a.AgentPassport, encodeFunctionData({ abi: passportAbi, functionName: "pay", args: [agentId, token, to, amount, ref] }));
    }
  }
  ctx.log(`needs the human: ${human} to ${to}`);
  return phoneTransfer(ctx, token, to, human, "via pap rpc (eth_sendTransaction)");
}

function isBrokered(data: Hex) {
  try {
    decodeFunctionData({ abi: erc20, data });
    return true;
  } catch {
    return false;
  }
}

/** Handles one JSON-RPC call. Exported for tests. */
export async function dispatch(ctx: Ctx, method: string, params: unknown[] = []): Promise<unknown> {
  const { id } = ctx;
  switch (method) {
    case "eth_accounts":
    case "eth_requestAccounts":
      return [id.address];
    case "eth_coinbase":
      return id.address;
    case "eth_sendTransaction":
      return sendTransaction(ctx, (params[0] ?? {}) as Tx);
    case "eth_estimateGas": {
      // The agent holds no tokens (the human pays through AgentPassport), so estimating an ERC-20
      // transfer "from the agent" would revert on HSK and tools like `cast send` would stop there.
      const tx = (params[0] ?? {}) as Tx;
      if (tx.from?.toLowerCase() === id.address.toLowerCase() && tx.data && isBrokered(tx.data)) return "0x30d40";
      return upstream(method, params);
    }
    case "personal_sign": {
      const [data, from] = params as [Hex, Address];
      mustBeAgent(id, from);
      return account(id).signMessage({ message: { raw: data } });
    }
    case "eth_sign": {
      const [from, data] = params as [Address, Hex];
      mustBeAgent(id, from);
      return account(id).signMessage({ message: { raw: data } });
    }
    case "eth_signTypedData_v4": {
      const [from, json] = params as [Address, string];
      mustBeAgent(id, from);
      const td = typeof json === "string" ? JSON.parse(json) : json;
      const { EIP712Domain: _drop, ...types } = td.types ?? {};
      void _drop;
      return account(id).signTypedData({ domain: td.domain, types, primaryType: td.primaryType, message: td.message });
    }
    case "eth_getEncryptionPublicKey": {
      mustBeAgent(id, params[0] as Address);
      return publicKeyOf(id.privateKey);
    }
    case "eth_decrypt":
      return decrypt(ctx, params as [unknown, Address]);
    case "wallet_getCapabilities":
      return capabilities(ctx);
    case "wallet_grantPermissions":
      return grantPermissions(ctx, params[0]);
    case "wallet_sendCalls":
      return sendCalls(ctx, params[0]);
    case "wallet_getCallsStatus":
      return callsStatus(params[0] as string);
    default:
      if (PASSTHROUGH.has(method)) return upstream(method, params);
      throw unsupported(`Method ${method} is not supported by pap rpc.`);
  }
}

// ───────────── eth_decrypt: sealed secrets (PAP-10) ─────────────

/**
 * eth_decrypt(payload, address). MetaMask used this for x25519 blobs; here it takes a PAP
 * secret reference and runs the double-signature flow:
 *   payload = "pap:secret:<name>"  or  hex/JSON of {"pap":"secret","name":…,"reason":…}
 * Returns the plaintext only after the human approves on their phone.
 */
async function decrypt(ctx: Ctx, [payload, from]: [unknown, Address]) {
  mustBeAgent(ctx.id, from);
  let text = typeof payload === "string" ? payload : JSON.stringify(payload);
  if (/^0x[0-9a-f]*$/i.test(text)) text = Buffer.from(text.slice(2), "hex").toString("utf8");
  let name: string | undefined;
  let reason = "Requested by a tool through eth_decrypt (pap rpc)";
  if (text.startsWith("pap:secret:")) name = text.slice("pap:secret:".length);
  else {
    try {
      const j = JSON.parse(text);
      if (j?.pap === "secret") {
        name = j.name;
        if (typeof j.reason === "string") reason = j.reason;
      } else if (j?.version === "x25519-xsalsa20-poly1305")
        throw unsupported("MetaMask x25519 blobs are not supported: PAP secrets are sealed with `pap seal`.");
    } catch (e) {
      if (e instanceof RpcError) throw e;
    }
  }
  if (!name) throw new RpcError(-32602, 'eth_decrypt expects "pap:secret:<name>" or {"pap":"secret","name":…,"reason":…}');
  const { requestId, url, showUrl } = await requestReveal(ctx.id, name, reason);
  ctx.log(`secret "${name}" requested — approve on the phone: ${url}`);
  openBrowser(showUrl);
  try {
    const v = await awaitReveal(ctx.id, requestId, name, WAIT_MS());
    if (v === null) throw new RpcError(4900, "Timed out waiting for the phone.");
    return v;
  } catch (e) {
    if (e instanceof RejectedError) throw rejected(e.message);
    if (e instanceof ExpiredError) throw new RpcError(4900, e.message);
    throw e;
  }
}

// ───────────── wallet_* (PAP-11) ─────────────

async function capabilities(ctx: Ctx) {
  const a = await addresses(ctx.id);
  const chain = `0x${hskTestnet.id.toString(16)}`;
  return {
    [chain]: {
      atomic: { status: "unsupported" },
      pap: {
        agent: ctx.id.address,
        agentId: ctx.id.agentId ?? null,
        owner: ctx.id.ownerAddress ?? null,
        passport: a.AgentPassport ?? null,
        secrets: { supported: true, method: "eth_decrypt", format: "pap:secret:<name>" },
        visas: { supported: true, method: "wallet_grantPermissions", types: ["erc20-token-allowance"] },
        gate: { supported: true, scheme: "pap-visa" },
      },
    },
  };
}

/**
 * EIP-7715 subset → AgentPassport.grant(). Supported: one permission of type
 * "erc20-token-allowance" {token, allowance} + expiry. It opens the phone's pairing-style
 * approval: the human sets the visa there (the agent can only ask).
 */
async function grantPermissions(ctx: Ctx, req: unknown) {
  const r = (req ?? {}) as {
    expiry?: number;
    permissions?: { type: string; data?: { token?: Address; allowance?: string } }[];
  };
  const perm = r.permissions?.[0];
  if (!perm || perm.type !== "erc20-token-allowance" || !perm.data?.token || !isAddress(perm.data.token))
    throw unsupported('Only one permission of type "erc20-token-allowance" {token, allowance} is supported.');
  const a = await addresses(ctx.id);
  if (!a.AgentPassport || !ctx.id.agentId) throw unauthorized("Agent not paired: run pap_connect first.");
  const current = await pub
    .readContract({ address: a.AgentPassport, abi: passportAbi, functionName: "canAct", args: [BigInt(ctx.id.agentId), transferScope(perm.data.token), 0n] })
    .catch(() => false);
  return {
    grantedPermissions: current ? [{ type: perm.type, data: perm.data }] : [],
    expiry: r.expiry ?? null,
    context: `pap:${ctx.id.agentId}:${transferScope(perm.data.token)}`,
    pap: {
      status: current ? "active" : "needs-owner",
      how: current
        ? "A visa for this token is already active on AgentPassport."
        : "Visas are granted by the human on their phone (AgentPassport.grant). Ask them to open the PAP wallet → Agents.",
    },
  };
}

const bundles = new Map<string, { status: number; receipts: { transactionHash: Hex }[]; error?: string }>();

/** EIP-5792 wallet_sendCalls: each ERC-20 transfer goes through eth_sendTransaction's rules, in order. */
async function sendCalls(ctx: Ctx, req: unknown) {
  const r = (req ?? {}) as { calls?: Tx[]; from?: Address; atomicRequired?: boolean };
  if (!Array.isArray(r.calls) || !r.calls.length) throw new RpcError(-32602, "calls[] required");
  if (r.atomicRequired) throw new RpcError(5760, "Atomic execution is not supported: each call is a separate PAP approval.");
  mustBeAgent(ctx.id, r.from);
  const id = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
  const bundle = { status: 100, receipts: [] as { transactionHash: Hex }[], error: undefined as string | undefined };
  bundles.set(id, bundle);
  (async () => {
    for (const c of r.calls!) {
      try {
        bundle.receipts.push({ transactionHash: await sendTransaction(ctx, { ...c, from: ctx.id.address }) });
      } catch (e) {
        bundle.status = 400;
        bundle.error = (e as Error).message;
        return;
      }
    }
    bundle.status = 200;
  })();
  return { id };
}

function callsStatus(id: string) {
  const b = bundles.get(id);
  if (!b) throw new RpcError(5730, "Unknown bundle id");
  return { version: "2.0.0", id, chainId: `0x${hskTestnet.id.toString(16)}`, status: b.status, atomic: false, receipts: b.receipts, ...(b.error ? { error: b.error } : {}) };
}

// ───────────── HTTP server ─────────────

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function one(ctx: Ctx, r: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown[] }) {
  if (!r || r.jsonrpc !== "2.0" || typeof r.method !== "string")
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
  try {
    const result = await dispatch(ctx, r.method, Array.isArray(r.params) ? r.params : []);
    return { jsonrpc: "2.0", id: r.id ?? null, result };
  } catch (e) {
    const err = e instanceof RpcError ? e : new RpcError(-32603, (e as Error).message);
    return { jsonrpc: "2.0", id: r.id ?? null, error: { code: err.code, message: err.message, ...(err.data ? { data: err.data } : {}) } };
  }
}

export function startRpcServer(ctx: Ctx, port: number, host = "127.0.0.1") {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    if (req.method !== "POST") return res.writeHead(405).end();
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
    }
    const out = Array.isArray(body) ? await Promise.all(body.map((b) => one(ctx, b))) : await one(ctx, body as never);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
  });
  return new Promise<typeof server>((resolve) => server.listen(port, host, () => resolve(server)));
}
