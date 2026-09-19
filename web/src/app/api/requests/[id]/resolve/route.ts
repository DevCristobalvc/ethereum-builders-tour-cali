import type { Hex } from "viem";
import { bad, json } from "@/lib/api";
import { verifySig } from "@/lib/sig";
import { read, write } from "@/lib/store";
import type { RequestState } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Phone → relay: outcome of a request. Body: { status: approved|rejected, txHash?, reason?, sig } (sig by owner) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await read<RequestState>("request", id);
  if (!state) return bad("not found", 404);
  if (state.status !== "pending") return bad("already resolved", 409);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.sig !== "string") return bad("sig required");
  const status = body.status === "approved" ? "approved" : "rejected";
  const payload = { requestId: id, status, txHash: String(body.txHash ?? ""), reason: String(body.reason ?? "") };
  if (!(await verifySig("resolve", payload, state.ownerAddress, body.sig as Hex))) return bad("bad signature", 401);

  const next: RequestState = {
    ...state,
    status,
    txHash: (payload.txHash || undefined) as RequestState["txHash"],
    reason: payload.reason || undefined,
    resolvedAt: Date.now(),
  };
  await write("request", id, next);
  return json(next);
}
