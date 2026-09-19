import { isAddress, type Address, type Hex } from "viem";
import { bad, json, baseUrl } from "@/lib/api";
import { verifySig } from "@/lib/sig";
import { newId, read, readAll, write } from "@/lib/store";
import type { AgentRecord, RequestState, TransferAction } from "@/lib/types";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;

/** Agent → relay: ask the human to approve an action. Body: { agentAddress, action, sig } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !isAddress(body.agentAddress) || !body.action || typeof body.sig !== "string")
    return bad("agentAddress, action, sig required");
  const a = body.action as TransferAction;
  if (a.type !== "transfer" || !isAddress(a.token) || !isAddress(a.to) || !/^\d+(\.\d+)?$/.test(String(a.amount)))
    return bad("action must be {type:'transfer', token, to, amount}");
  const action: TransferAction = { type: "transfer", token: a.token, to: a.to, amount: String(a.amount), memo: a.memo ?? "" };
  const payload = { agentAddress: body.agentAddress as Address, action };
  if (!(await verifySig("request", payload, payload.agentAddress, body.sig as Hex))) return bad("bad signature", 401);

  const agent = await read<AgentRecord>("agent", payload.agentAddress.toLowerCase());
  if (!agent) return bad("agent not paired - run pap_connect first", 403);

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
