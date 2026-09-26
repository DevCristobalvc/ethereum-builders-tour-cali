import { isAddress, type Address, type Hex } from "viem";
import { bad, json } from "@/lib/api";
import { messageSignerKey } from "@/lib/secrets";
import { verifySig } from "@/lib/sig";
import { read, write } from "@/lib/store";
import type { AgentRecord, PairState } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Phone → relay: pairing result. Body: { ownerAddress, agentId, txHash, status, sig } (sig by owner) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pair = await read<PairState>("pair", id);
  if (!pair) return bad("not found", 404);
  if (pair.status !== "pending") return bad("already resolved", 409);

  const body = await req.json().catch(() => null);
  if (!body || !isAddress(body.ownerAddress) || typeof body.sig !== "string") return bad("ownerAddress, sig required");
  const status = body.status === "rejected" ? "rejected" : "approved";
  const payload = {
    pairId: id,
    ownerAddress: body.ownerAddress as Address,
    agentId: String(body.agentId ?? ""),
    txHash: String(body.txHash ?? ""),
    status,
  };
  if (!(await verifySig("pair-approve", payload, payload.ownerAddress, body.sig as Hex))) return bad("bad signature", 401);

  const next: PairState = {
    ...pair,
    status,
    ownerAddress: payload.ownerAddress,
    agentId: payload.agentId || undefined,
    txHash: (payload.txHash || undefined) as PairState["txHash"],
    resolvedAt: Date.now(),
  };
  await write("pair", id, next);
  if (status === "approved") {
    const rec: AgentRecord = {
      agentAddress: pair.agentAddress,
      agentName: pair.agentName,
      ownerAddress: payload.ownerAddress,
      agentId: payload.agentId,
      pairedAt: Date.now(),
      agentPublicKey: pair.agentPublicKey,
      ownerPublicKey: (await messageSignerKey("pair-approve", payload, body.sig as Hex)) ?? undefined,
    };
    await write("agent", pair.agentAddress.toLowerCase(), rec);
  }
  return json(next);
}
