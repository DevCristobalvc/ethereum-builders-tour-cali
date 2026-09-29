import { isAddress, type Address, type Hex } from "viem";
import { bad, json } from "@/lib/api";
import { meta, readSecret, secretId } from "@/lib/secrets";
import { verifySig } from "@/lib/sig";
import { write } from "@/lib/store";
import type { SecretRecord } from "@/lib/types";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agent: string; name: string }> };

/** Secret metadata + sealed blob (ciphertext only: the phone needs it to peel its layer). */
export async function GET(_: Request, { params }: Params) {
  const { agent, name } = await params;
  if (!isAddress(agent)) return bad("bad agent address");
  const s = await readSecret(agent as Address, name);
  return s ? json({ ...meta(s), blob: s.status === "active" ? s.blob : undefined }) : bad("not found", 404);
}

/** Owner revokes a secret. Body: { sig } = personal_sign canonical("secret-revoke", {agentAddress, name}). */
export async function DELETE(req: Request, { params }: Params) {
  const { agent, name } = await params;
  if (!isAddress(agent)) return bad("bad agent address");
  const s = await readSecret(agent as Address, name);
  if (!s) return bad("not found", 404);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.sig !== "string") return bad("sig required");
  const payload = { agentAddress: s.agentAddress, name };
  if (!(await verifySig("secret-revoke", payload, s.ownerAddress, body.sig as Hex))) return bad("bad signature", 401);
  const next: SecretRecord = { ...s, status: "revoked", revokedAt: Date.now(), blob: "" };
  await write("secret", secretId(s.agentAddress, name), next);
  return json(meta(next));
}
