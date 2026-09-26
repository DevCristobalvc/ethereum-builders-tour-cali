import { isAddress, type Address, type Hex } from "viem";
import { bad, json, baseUrl } from "@/lib/api";
import { SECRET_NAME } from "@/lib/pap-core";
import { MAX_REQUEST_TTL_S, nowS, readSecret, rememberKey, typedSigner, consumeNonce } from "@/lib/secrets";
import { verifySig } from "@/lib/sig";
import { newId, read, readAll, write } from "@/lib/store";
import type { Action, AgentRecord, RequestState, RevealAction, TransferAction } from "@/lib/types";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;

/**
 * Agent → relay: ask the human to approve an action. Body: { agentAddress, action, sig }
 *  - transfer: sig = personal_sign over canonical("request", {agentAddress, action})
 *  - reveal:   sig = EIP-712 RevealRequest {agent, name, reason, nonce, expiry}
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !isAddress(body.agentAddress) || !body.action || typeof body.sig !== "string")
    return bad("agentAddress, action, sig required");
  const agentAddress = body.agentAddress as Address;

  let action: Action;
  let agent = await read<AgentRecord>("agent", agentAddress.toLowerCase());
  if (body.action.type === "reveal") {
    const a = body.action as RevealAction;
    if (typeof a.name !== "string" || !SECRET_NAME.test(a.name)) return bad("invalid secret name");
    if (typeof a.reason !== "string" || a.reason.trim().length < 10 || a.reason.length > 280)
      return bad("reason required (10-280 chars): it is what your human sees before approving");
    if (!/^\d+$/.test(String(a.expiry))) return bad("expiry (unix seconds) required");
    const expiry = Number(a.expiry);
    if (expiry <= nowS() || expiry > nowS() + MAX_REQUEST_TTL_S) return bad(`expiry must be within ${MAX_REQUEST_TTL_S}s`);
    action = { type: "reveal", name: a.name, reason: a.reason.trim(), nonce: String(a.nonce), expiry: String(expiry) };
    const signer = await typedSigner(
      "RevealRequest",
      { agent: agentAddress, name: action.name, reason: action.reason, nonce: action.nonce, expiry: BigInt(action.expiry) },
      body.sig as Hex
    );
    if (!signer || signer.address.toLowerCase() !== agentAddress.toLowerCase()) return bad("bad signature", 401);
    if (!agent) return bad("agent not paired - run pap_connect first", 403);
    const secret = await readSecret(agentAddress, action.name);
    if (!secret || secret.status !== "active") return bad(`no active secret '${action.name}' for this agent`, 404);
    if (Number(secret.expiry) <= nowS()) return bad(`secret '${action.name}' expired - ask your human to seal it again`, 410);
    if (secret.reads >= Number(secret.maxReads)) return bad(`secret '${action.name}' reached its read limit`, 429);
    if (!(await consumeNonce(agentAddress, action.nonce))) return bad("nonce missing, malformed or already used", 409);
    agent = await rememberKey(agent, "agentPublicKey", signer.publicKey);
  } else {
    const a = body.action as TransferAction;
    if (a.type !== "transfer" || !isAddress(a.token) || !isAddress(a.to) || !/^\d+(\.\d+)?$/.test(String(a.amount)))
      return bad("action must be {type:'transfer', token, to, amount} or {type:'reveal', name, reason, nonce, expiry}");
    action = { type: "transfer", token: a.token, to: a.to, amount: String(a.amount), memo: a.memo ?? "" };
    if (!(await verifySig("request", { agentAddress, action }, agentAddress, body.sig as Hex))) return bad("bad signature", 401);
    if (!agent) return bad("agent not paired - run pap_connect first", 403);
  }

  const now = Date.now();
  const state: RequestState = {
    id: newId(),
    status: "pending",
    agentAddress: agent.agentAddress,
    agentName: agent.agentName,
    agentId: agent.agentId,
    ownerAddress: agent.ownerAddress,
    action,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  await write("request", state.id, state);
  return json({
    requestId: state.id,
    url: `${baseUrl()}/approve/${state.id}`,
    showUrl: `${baseUrl()}/show/request/${state.id}`,
    expiresAt: state.expiresAt,
  });
}

/** Phone → relay: list requests for an owner. ?owner=0x.. */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner")?.toLowerCase();
  if (!owner) return bad("owner required");
  const all = await readAll<RequestState>("request", 50);
  return json(all.filter((r) => r.ownerAddress.toLowerCase() === owner));
}
