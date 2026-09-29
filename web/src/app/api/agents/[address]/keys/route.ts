import { isAddress, type Hex } from "viem";
import { bad, json } from "@/lib/api";
import { messageSignerKey, rememberKey } from "@/lib/secrets";
import { verifySig } from "@/lib/sig";
import { read } from "@/lib/store";
import type { AgentRecord } from "@/lib/types";
export const dynamic = "force-dynamic";

/**
 * Publish the agent's or the owner's public key for agents paired before secrets existed.
 * Body: { role: "agent" | "owner", sig } = personal_sign canonical("pubkey", {agentAddress, role}).
 */
export async function POST(req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) return bad("bad address");
  const agent = await read<AgentRecord>("agent", address.toLowerCase());
  if (!agent) return bad("not paired", 404);
  const body = await req.json().catch(() => null);
  if (!body || (body.role !== "agent" && body.role !== "owner") || typeof body.sig !== "string") return bad("role, sig required");
  const payload = { agentAddress: agent.agentAddress, role: body.role };
  const expected = body.role === "agent" ? agent.agentAddress : agent.ownerAddress;
  if (!(await verifySig("pubkey", payload, expected, body.sig as Hex))) return bad("bad signature", 401);
  const key = await messageSignerKey("pubkey", payload, body.sig as Hex);
  if (!key) return bad("bad signature", 401);
  return json(await rememberKey(agent, body.role === "agent" ? "agentPublicKey" : "ownerPublicKey", key));
}
