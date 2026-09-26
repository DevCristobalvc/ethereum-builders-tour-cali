import { isAddress, type Address, type Hex } from "viem";
import { bad, json, baseUrl } from "@/lib/api";
import { messageSignerKey } from "@/lib/secrets";
import { verifySig } from "@/lib/sig";
import { newId, write } from "@/lib/store";
import type { PairState } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Agent → relay: start a pairing. Body: { agentAddress, agentName, sig } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !isAddress(body.agentAddress) || typeof body.agentName !== "string" || typeof body.sig !== "string")
    return bad("agentAddress, agentName, sig required");
  const payload = { agentAddress: body.agentAddress as Address, agentName: body.agentName };
  if (!(await verifySig("pair", payload, payload.agentAddress, body.sig as Hex))) return bad("bad signature", 401);

  const agentPublicKey = (await messageSignerKey("pair", payload, body.sig as Hex)) ?? undefined;
  const state: PairState = { id: newId(), status: "pending", ...payload, agentPublicKey, createdAt: Date.now() };
  await write("pair", state.id, state);
  return json({
    pairId: state.id,
    url: `${baseUrl()}/pair/${state.id}`,
    showUrl: `${baseUrl()}/show/pair/${state.id}`,
  });
}
