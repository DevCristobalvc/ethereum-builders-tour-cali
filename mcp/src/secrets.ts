/** Client side of sealed secrets, shared by the MCP tools and the `pap` CLI. */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Address, Hex } from "viem";
import { addresses } from "./chain.js";
import { account, identityDir, type Identity } from "./identity.js";
import { openAgentLayer, assertSecretName, blobHash, sealSecret, typedData, wire } from "./pap-core.js";
import { call, sign, waitFor } from "./relay.js";

export type SecretMeta = {
  name: string;
  status: "pending" | "active" | "revoked";
  maxReads: string;
  reads: number;
  expiry: string;
  lastReadAt?: number;
};

type RevealState = {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  result?: string;
  reason?: string;
  txHash?: Hex;
};

type AgentRecord = { agentPublicKey?: Hex; ownerPublicKey?: Hex; ownerAddress: Address };

export class RejectedError extends Error {
  code = 4001;
}
export class ExpiredError extends Error {
  code = 4900;
}

const nonce = () => crypto.randomUUID().replace(/-/g, "");
const nowS = () => Math.floor(Date.now() / 1000);

async function passport(id: Identity): Promise<Address> {
  const a = await addresses(id);
  if (!a.AgentPassport) throw new Error("AgentPassport address unknown (relay /api/health)");
  return a.AgentPassport;
}

export function requirePaired(id: Identity) {
  if (!id.ownerAddress) throw new Error("Not paired. Run pap_connect (MCP) or ask your human to pair this agent first.");
}

export async function listSecrets(id: Identity): Promise<SecretMeta[]> {
  await ensureAgentKey(id).catch(() => {}); // lets the phone's vault page seal for this agent
  return call<SecretMeta[]>(id, `/api/secrets?agent=${id.address}`);
}

/** Publish this agent's public key on the relay if it doesn't have it yet. */
async function ensureAgentKey(id: Identity): Promise<AgentRecord> {
  const rec = await call<AgentRecord>(id, `/api/agents/${id.address}`);
  if (rec.agentPublicKey) return rec;
  const payload = { agentAddress: id.address, role: "agent" };
  return call<AgentRecord>(id, `/api/agents/${id.address}/keys`, {
    method: "POST",
    body: JSON.stringify({ role: "agent", sig: await sign(id, "pubkey", payload) }),
  });
}

/** Make sure the relay knows both public keys; publish the agent's own if missing. */
async function keys(id: Identity): Promise<{ agentPub: Hex; ownerPub: Hex }> {
  const rec = await ensureAgentKey(id);
  if (!rec.ownerPublicKey)
    throw new Error(
      "The relay doesn't know your phone's public key yet (agent paired before secrets existed). Approve any request on the phone once, then retry."
    );
  return { agentPub: rec.agentPublicKey!, ownerPub: rec.ownerPublicKey };
}

/**
 * Seal `value` for this agent (runs on the human's laptop, where the agent identity lives).
 * The relay gets ciphertext only; the phone then grants the on-chain visa and activates it.
 */
export async function seal(id: Identity, name: string, value: string, opts: { maxReads: number; days: number }) {
  requirePaired(id);
  assertSecretName(name);
  const { agentPub, ownerPub } = await keys(id);
  const blob = await sealSecret(value, { name, agent: id.address, agentPub, ownerPub });
  const msg = {
    agent: id.address,
    name,
    blobHash: blobHash(blob),
    maxReads: BigInt(opts.maxReads),
    expiry: BigInt(nowS() + Math.round(opts.days * 86400)),
    nonce: nonce(),
  };
  const sig = await account(id).signTypedData(typedData(await passport(id), "SealRequest", msg));
  return call<{ status: string; requestId: string; url: string; showUrl: string; replaces: boolean }>(id, "/api/secrets", {
    method: "POST",
    body: JSON.stringify({ agentAddress: id.address, name, blob, ...wire({ maxReads: msg.maxReads, expiry: msg.expiry }), nonce: msg.nonce, sig }),
  });
}

/** Ask the human to release secret `name`. Returns the request to wait on. */
export async function requestReveal(id: Identity, name: string, reason: string) {
  requirePaired(id);
  assertSecretName(name);
  if (reason.trim().length < 10) throw new Error("reason must say concretely why (10+ chars): your human reads it before approving");
  const msg = { agent: id.address, name, reason: reason.trim(), nonce: nonce(), expiry: BigInt(nowS() + 10 * 60) };
  const sig = await account(id).signTypedData(typedData(await passport(id), "RevealRequest", msg));
  return call<{ requestId: string; url: string; showUrl: string }>(id, "/api/requests", {
    method: "POST",
    body: JSON.stringify({ agentAddress: id.address, action: { type: "reveal", ...wire(msg) }, sig }),
  });
}

/** Wait for the phone; on approval open the inner layer with the identity key. */
export async function awaitReveal(id: Identity, requestId: string, name: string, maxMs: number): Promise<string | null> {
  const st = await waitFor<RevealState>(id, `/api/requests/${requestId}`, maxMs);
  if (!st || st.status === "pending") return null;
  if (st.status === "rejected") throw new RejectedError(`Rejected by your human${st.reason ? ` (${st.reason})` : ""}. Do not retry.`);
  if (st.status === "expired") throw new ExpiredError("Request expired without a decision.");
  if (!st.result) throw new Error("approved but no result from the relay");
  return openAgentLayer(st.result, id.privateKey, { name, agent: id.address });
}

/** Write a secret to ~/.pap/secrets/<name> (0600) so it never has to be printed. */
export function writeSecretFile(name: string, value: string) {
  const dir = join(identityDir(), "secrets");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, name);
  writeFileSync(file, value, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

/** PAP_SECRET_<NAME> with - → _ */
export const envName = (name: string) => `PAP_SECRET_${name.toUpperCase().replace(/-/g, "_")}`;
