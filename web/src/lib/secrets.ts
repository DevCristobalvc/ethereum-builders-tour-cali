/** Relay-side helpers for sealed secrets (server only). */
import { getAddress, type Address, type Hex } from "viem";
import { publicKeyToAddress } from "viem/utils";
import { ADDRESSES } from "./chain";
import { publicKeyFromMessageSig, publicKeyFromTypedSig } from "./pap-core";
import { canonical } from "./sig";
import { read, write } from "./store";
import type { AgentRecord, SecretMeta, SecretRecord } from "./types";

export const secretId = (agent: Address, name: string) => `${agent.toLowerCase()}.${name}`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const meta = ({ blob, ...m }: SecretRecord): SecretMeta => m;

export function passport(): Address {
  if (!ADDRESSES.AgentPassport) throw new Error("AgentPassport not deployed");
  return ADDRESSES.AgentPassport;
}

/** Longest a signed reveal request may be valid for. */
export const MAX_REQUEST_TTL_S = 15 * 60;

/** Signer of an EIP-712 message, with its public key (null on malformed signatures). */
export async function typedSigner(
  primaryType: Parameters<typeof publicKeyFromTypedSig>[1],
  message: Parameters<typeof publicKeyFromTypedSig>[2],
  signature: Hex
): Promise<{ address: Address; publicKey: Hex } | null> {
  try {
    const publicKey = await publicKeyFromTypedSig(passport(), primaryType, message, signature);
    return { address: getAddress(publicKeyToAddress(publicKey)), publicKey };
  } catch {
    return null;
  }
}

/** Public key behind a canonical relay signature (same message verifySig checks). */
export async function messageSignerKey(kind: string, payload: unknown, signature: Hex): Promise<Hex | null> {
  try {
    return await publicKeyFromMessageSig(canonical(kind, payload), signature);
  } catch {
    return null;
  }
}

/** Single-use nonces per signer. Returns false if already used. */
export async function consumeNonce(signer: Address, nonce: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) return false;
  const id = `${signer.toLowerCase()}.${nonce}`;
  if (await read("nonce", id)) return false;
  await write("nonce", id, { usedAt: Date.now() });
  return true;
}

/** Remember a public key on the agent record the first time we see it. */
export async function rememberKey(agent: AgentRecord, field: "agentPublicKey" | "ownerPublicKey", key: Hex) {
  if (agent[field]) return agent;
  const next = { ...agent, [field]: key };
  await write("agent", agent.agentAddress.toLowerCase(), next);
  return next;
}

export async function readSecret(agent: Address, name: string) {
  return read<SecretRecord>("secret", secretId(agent, name));
}

export const nowS = () => Math.floor(Date.now() / 1000);
