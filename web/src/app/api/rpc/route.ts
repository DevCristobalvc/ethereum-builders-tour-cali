/**
 * JSON-RPC 2.0 endpoint for PAP (`pap_*` namespace). Every method delegates to the REST route
 * handler that already implements it, so signatures, checks and storage are identical.
 * Spec: docs/RPC.md. Errors follow JSON-RPC 2.0 + EIP-1474 codes.
 */
import { createPublicClient, http, isHex, type Hex } from "viem";
import { ABI, ADDRESSES, hskTestnet } from "@/lib/chain";
import * as agentRoute from "../agents/[address]/route";
import * as requestsRoute from "../requests/route";
import * as requestRoute from "../requests/[id]/route";
import * as secretsRoute from "../secrets/route";
export const dynamic = "force-dynamic";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type RpcRequest = { jsonrpc: "2.0"; method: string; params?: Json; id?: string | number | null };
type RpcError = { code: number; message: string; data?: Json };

const ERR = {
  parse: { code: -32700, message: "Parse error" },
  invalidRequest: { code: -32600, message: "Invalid Request" },
  methodNotFound: { code: -32601, message: "Method not found" },
  invalidParams: (m: string) => ({ code: -32602, message: m }),
  internal: (m: string) => ({ code: -32603, message: m }),
};

/** REST status → JSON-RPC / EIP-1474 error code. */
const codeFor = (status: number) =>
  ({ 400: -32602, 401: -32000, 403: -32002, 404: -32001, 409: -32000, 410: -32003, 429: -32005 })[status] ?? -32603;

class RpcFail extends Error {
  constructor(public err: RpcError) {
    super(err.message);
  }
}

const base = "http://rpc.local";
const jsonReq = (path: string, method = "GET", body?: unknown) =>
  new Request(base + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

/** Run a REST handler and unwrap its JSON, turning HTTP errors into JSON-RPC errors. */
async function via(res: Response | Promise<Response>): Promise<Json> {
  const r = await res;
  const data = (await r.json().catch(() => null)) as Json;
  if (!r.ok) {
    const message = (data && typeof data === "object" && !Array.isArray(data) && typeof data.error === "string" && data.error) || `HTTP ${r.status}`;
    throw new RpcFail({ code: codeFor(r.status), message, data: { httpStatus: r.status } });
  }
  return data;
}

/** Accept by-name params `{…}` or a single by-position object `[{…}]`. */
function obj(params: Json | undefined): Record<string, Json> {
  const p = Array.isArray(params) ? params[0] : params;
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new RpcFail(ERR.invalidParams("params must be an object (or [object])"));
  return p;
}
const str = (p: Record<string, Json>, k: string) => {
  if (typeof p[k] !== "string" || !p[k]) throw new RpcFail(ERR.invalidParams(`${k} (string) required`));
  return p[k] as string;
};

const chain = createPublicClient({ chain: hskTestnet, transport: http() });

const METHODS: Record<string, { summary: string; params: string; run: (p: Json | undefined) => Promise<Json> }> = {
  pap_requestTransfer: {
    summary: "Agent asks its human to approve a transfer (same body as POST /api/requests, action.type='transfer').",
    params: "{agentAddress, action:{type:'transfer', token, to, amount, memo?}, sig}",
    run: async (params) => {
      const p = obj(params);
      if ((p.action as { type?: string } | null)?.type !== "transfer") throw new RpcFail(ERR.invalidParams("action.type must be 'transfer'"));
      return via(requestsRoute.POST(jsonReq("/api/requests", "POST", p)));
    },
  },
  pap_requestSecret: {
    summary: "Agent asks to read a sealed secret; sig is an EIP-712 RevealRequest.",
    params: "{agentAddress, action:{type:'reveal', name, reason, nonce, expiry}, sig}",
    run: async (params) => {
      const p = obj(params);
      if ((p.action as { type?: string } | null)?.type !== "reveal") throw new RpcFail(ERR.invalidParams("action.type must be 'reveal'"));
      return via(requestsRoute.POST(jsonReq("/api/requests", "POST", p)));
    },
  },
  pap_sealSecret: {
    summary: "Store a sealed secret (ciphertext only); sig is an EIP-712 SealRequest by the agent (pending) or the owner (active).",
    params: "{agentAddress, name, blob, maxReads, expiry, nonce, sig, grantTx?}",
    run: async (params) => via(secretsRoute.POST(jsonReq("/api/secrets", "POST", obj(params)))),
  },
  pap_getRequest: {
    summary: "State of a request: pending | approved | rejected | expired (+ txHash, and result for approved reveals).",
    params: "{id}",
    run: async (params) => {
      const id = str(obj(params), "id");
      return via(requestRoute.GET(jsonReq(`/api/requests/${id}`), { params: Promise.resolve({ id }) }));
    },
  },
  pap_listSecrets: {
    summary: "Metadata (never values) of the secrets of an agent or an owner.",
    params: "{agent} | {owner}",
    run: async (params) => {
      const p = obj(params);
      const q = typeof p.agent === "string" ? `agent=${p.agent}` : typeof p.owner === "string" ? `owner=${p.owner}` : null;
      if (!q) throw new RpcFail(ERR.invalidParams("agent or owner required"));
      return via(secretsRoute.GET(jsonReq(`/api/secrets?${q}`)));
    },
  },
  pap_getAgent: {
    summary: "Relay record of a paired agent (owner, ERC-8004 agentId, public keys).",
    params: "{address}",
    run: async (params) => {
      const address = str(obj(params), "address");
      return via(agentRoute.GET(jsonReq(`/api/agents/${address}`), { params: Promise.resolve({ address }) }));
    },
  },
  pap_canAct: {
    summary: "AgentPassport.canAct(agentId, scope, amount) on HSK Chain.",
    params: "{agentId, scope (bytes32), amount}",
    run: async (params) => {
      const p = obj(params);
      const scope = str(p, "scope");
      if (!isHex(scope) || scope.length !== 66) throw new RpcFail(ERR.invalidParams("scope must be bytes32 hex"));
      if (!ADDRESSES.AgentPassport) throw new RpcFail(ERR.internal("AgentPassport not deployed"));
      const ok = await chain.readContract({
        address: ADDRESSES.AgentPassport,
        abi: ABI.AgentPassport,
        functionName: "canAct",
        args: [BigInt(String(p.agentId)), scope as Hex, BigInt(String(p.amount ?? "0"))],
      });
      return Boolean(ok);
    },
  },
  pap_chainId: {
    summary: "Chain the relay's contracts live on (HSK Chain testnet = 0x85).",
    params: "none",
    run: async () => `0x${hskTestnet.id.toString(16)}`,
  },
  pap_contracts: {
    summary: "Deployed contract addresses.",
    params: "none",
    run: async () => ADDRESSES as Json,
  },
  "rpc.discover": {
    summary: "List of methods with their params.",
    params: "none",
    run: async () => ({
      name: "PAP JSON-RPC",
      version: "1",
      methods: Object.entries(METHODS).map(([name, m]) => ({ name, summary: m.summary, params: m.params })),
    }),
  },
};

async function handle(req: unknown): Promise<object | null> {
  const r = req as RpcRequest;
  const valid = r && typeof r === "object" && r.jsonrpc === "2.0" && typeof r.method === "string";
  const id = valid && "id" in r ? (r.id ?? null) : null;
  const isNotification = valid && !("id" in r);
  if (!valid) return { jsonrpc: "2.0", id: null, error: ERR.invalidRequest };
  const m = METHODS[r.method];
  try {
    if (!m) throw new RpcFail(ERR.methodNotFound);
    const result = await m.run(r.params);
    return isNotification ? null : { jsonrpc: "2.0", id, result };
  } catch (e) {
    if (isNotification) return null;
    const error = e instanceof RpcFail ? e.err : ERR.internal((e as Error).message ?? "internal error");
    return { jsonrpc: "2.0", id, error };
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: ERR.parse });
  }
  if (Array.isArray(body)) {
    if (body.length === 0) return Response.json({ jsonrpc: "2.0", id: null, error: ERR.invalidRequest });
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 204 });
  }
  const out = await handle(body);
  return out ? Response.json(out) : new Response(null, { status: 204 });
}

/** GET /api/rpc → method list (same as rpc.discover), handy for humans. */
export async function GET() {
  return Response.json(await METHODS["rpc.discover"].run(undefined));
}
