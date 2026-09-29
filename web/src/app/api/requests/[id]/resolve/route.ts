import type { Hex } from "viem";
import { bad, json } from "@/lib/api";
import { blobHash } from "@/lib/pap-core";
import { messageSignerKey, readSecret, rememberKey, secretId, typedSigner } from "@/lib/secrets";
import { verifySig } from "@/lib/sig";
import { read, write } from "@/lib/store";
import type { AgentRecord, RequestState, SecretRecord } from "@/lib/types";
export const dynamic = "force-dynamic";

/**
 * Phone → relay: outcome of a request. Body: { status: approved|rejected, txHash?, reason?, sig } (sig by owner)
 *  - reveal (approved): + { result, approvalSig } — result is the inner blob (encrypted to the agent),
 *    approvalSig an EIP-712 RevealApproval over its hash; txHash is the AgentPassport.record() stamp.
 *  - seal (approved): txHash is the AgentPassport.grant() for the secret's scope; the secret becomes active.
 */
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

  const action = state.action;
  if (status === "approved" && action.type === "reveal") {
    if (typeof body.result !== "string" || typeof body.approvalSig !== "string") return bad("result and approvalSig required");
    const signer = await typedSigner(
      "RevealApproval",
      { requestId: id, agent: state.agentAddress, name: action.name, resultHash: blobHash(body.result) },
      body.approvalSig as Hex
    );
    if (!signer || signer.address.toLowerCase() !== state.ownerAddress.toLowerCase()) return bad("bad approval signature", 401);
    const secret = await readSecret(state.agentAddress, action.name);
    if (!secret || secret.status !== "active") return bad("secret no longer active", 410);
    next.result = body.result;
    next.approvalSig = body.approvalSig as Hex;
    await write<SecretRecord>("secret", secretId(state.agentAddress, action.name), {
      ...secret,
      reads: secret.reads + 1,
      lastReadAt: Date.now(),
    });
  }

  if (action.type === "seal") {
    const pending = await read<SecretRecord>("secret", `pending.${id}`);
    if (status === "approved") {
      if (!pending) return bad("sealed blob not found", 404);
      await write<SecretRecord>("secret", secretId(state.agentAddress, action.name), {
        ...pending,
        staging: undefined,
        status: "active",
        grantTx: next.txHash,
        activatedAt: Date.now(),
      });
    }
    if (pending) await write<SecretRecord>("secret", `pending.${id}`, { ...pending, status: "revoked", revokedAt: Date.now() });
  }

  await write("request", id, next);
  const agent = await read<AgentRecord>("agent", state.agentAddress.toLowerCase());
  const ownerKey = await messageSignerKey("resolve", payload, body.sig as Hex);
  if (agent && ownerKey) await rememberKey(agent, "ownerPublicKey", ownerKey);
  return json(next);
}
