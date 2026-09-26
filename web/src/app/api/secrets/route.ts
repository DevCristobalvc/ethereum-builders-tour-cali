import { isAddress, type Address, type Hex } from "viem";
import { after } from "next/server";
import { bad, baseUrl, json } from "@/lib/api";
import { notifyOwner } from "@/lib/push";
import { blobHash, SECRET_NAME } from "@/lib/pap-core";
import { meta, nowS, readSecret, rememberKey, secretId, typedSigner, consumeNonce } from "@/lib/secrets";
import { newId, read, readAll, write } from "@/lib/store";
import type { AgentRecord, RequestState, SealAction, SecretRecord } from "@/lib/types";
export const dynamic = "force-dynamic";

const MAX_BLOB = 16 * 1024;
const MAX_READS = 1000;
const MAX_EXPIRY_S = 365 * 86400;
const TTL_MS = 10 * 60 * 1000;

/**
 * Store a sealed secret. Body: { agentAddress, name, blob, maxReads, expiry, nonce, sig, grantTx? }
 * sig = EIP-712 SealRequest {agent, name, blobHash, maxReads, expiry, nonce}.
 *  - signed by the AGENT key (the `pap seal` CLI on the laptop): stored as pending and a
 *    "seal" request goes to the phone, which grants the on-chain visa and activates it.
 *  - signed by the OWNER (phone / vault page, after granting the visa itself): active at once.
 * The relay never sees plaintext: `blob` is ECIES(owner, ECIES(agent, secret)).
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !isAddress(b.agentAddress) || typeof b.sig !== "string" || typeof b.blob !== "string")
    return bad("agentAddress, name, blob, maxReads, expiry, nonce, sig required");
  const agentAddress = b.agentAddress as Address;
  if (typeof b.name !== "string" || !SECRET_NAME.test(b.name)) return bad("name must be 1-64 chars of a-z 0-9 _ -");
  if (b.blob.length > MAX_BLOB) return bad("blob too large");
  if (!/^\d+$/.test(String(b.maxReads)) || Number(b.maxReads) < 1 || Number(b.maxReads) > MAX_READS)
    return bad(`maxReads must be 1-${MAX_READS}`);
  if (!/^\d+$/.test(String(b.expiry)) || Number(b.expiry) <= nowS() || Number(b.expiry) > nowS() + MAX_EXPIRY_S)
    return bad("expiry must be in the future and within a year");

  const action: SealAction = {
    type: "seal",
    name: b.name,
    blobHash: blobHash(b.blob),
    maxReads: String(b.maxReads),
    expiry: String(b.expiry),
    nonce: String(b.nonce),
  };
  const signer = await typedSigner(
    "SealRequest",
    {
      agent: agentAddress,
      name: action.name,
      blobHash: action.blobHash,
      maxReads: BigInt(action.maxReads),
      expiry: BigInt(action.expiry),
      nonce: action.nonce,
    },
    b.sig as Hex
  );
  if (!signer) return bad("bad signature", 401);

  let agent = await read<AgentRecord>("agent", agentAddress.toLowerCase());
  if (!agent) return bad("agent not paired - run pap_connect first", 403);
  const byAgent = signer.address.toLowerCase() === agentAddress.toLowerCase();
  const byOwner = signer.address.toLowerCase() === agent.ownerAddress.toLowerCase();
  if (!byAgent && !byOwner) return bad("signer is neither the agent nor its owner", 401);
  if (!(await consumeNonce(signer.address, action.nonce))) return bad("nonce missing, malformed or already used", 409);
  agent = await rememberKey(agent, byAgent ? "agentPublicKey" : "ownerPublicKey", signer.publicKey);

  const record: SecretRecord = {
    name: action.name,
    agentAddress: agent.agentAddress,
    ownerAddress: agent.ownerAddress,
    agentId: agent.agentId,
    blob: b.blob,
    blobHash: action.blobHash,
    maxReads: action.maxReads,
    expiry: action.expiry,
    status: "pending",
    createdAt: Date.now(),
    reads: 0,
  };

  if (byOwner) {
    const active: SecretRecord = {
      ...record,
      status: "active",
      activatedAt: Date.now(),
      grantTx: typeof b.grantTx === "string" ? (b.grantTx as Hex) : undefined,
    };
    await write("secret", secretId(agentAddress, action.name), active);
    return json({ status: "active", secret: meta(active) });
  }

  const now = Date.now();
  const request: RequestState = {
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
  await write("secret", `pending.${request.id}`, { ...record, sealRequestId: request.id, staging: true });
  await write("request", request.id, request);
  after(() => notifyOwner(request.ownerAddress, request.agentName, action, `/approve/${request.id}`).catch(() => {}));
  const replaces = await readSecret(agentAddress, action.name);
  return json({
    status: "pending",
    requestId: request.id,
    url: `${baseUrl()}/approve/${request.id}`,
    showUrl: `${baseUrl()}/show/request/${request.id}`,
    expiresAt: request.expiresAt,
    replaces: replaces?.status === "active",
  });
}

/** Metadata (never blobs) of the secrets of an agent or of an owner. ?agent=0x.. | ?owner=0x.. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const agent = q.get("agent")?.toLowerCase();
  const owner = q.get("owner")?.toLowerCase();
  if (!agent && !owner) return bad("agent or owner required");
  const all = await readAll<SecretRecord>("secret", 500);
  return json(
    all
      .filter((s) => !s.staging) // in-flight seals waiting for the phone
      .filter((s) => (agent ? s.agentAddress.toLowerCase() === agent : s.ownerAddress.toLowerCase() === owner))
      .map(meta)
  );
}
