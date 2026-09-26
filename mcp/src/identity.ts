/**
 * Agent identity: a secp256k1 key that only proves "this request comes from this
 * agent". It never holds funds. Lives in ~/.pap/agent.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

export type Identity = {
  privateKey: Hex;
  address: Address;
  name: string;
  relay: string;
  ownerAddress?: Address;
  agentId?: string;
  pairedAt?: number;
  contacts: Record<string, Address>;
};

const DIR = process.env.PAP_HOME ?? join(homedir(), ".pap");
const FILE = join(DIR, "agent.json");
export const DEFAULT_RELAY = process.env.PAP_RELAY_URL ?? "https://pap.devcristobalvc.com";

export function loadIdentity(): Identity | null {
  if (!existsSync(FILE)) return null;
  const id = JSON.parse(readFileSync(FILE, "utf8")) as Identity;
  id.contacts ??= {};
  if (process.env.PAP_RELAY_URL) id.relay = process.env.PAP_RELAY_URL;
  return id;
}

export function createIdentity(name: string): Identity {
  const privateKey = generatePrivateKey();
  const id: Identity = {
    privateKey,
    address: privateKeyToAccount(privateKey).address,
    name,
    relay: DEFAULT_RELAY,
    contacts: {},
  };
  saveIdentity(id);
  return id;
}

export function saveIdentity(id: Identity) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(id, null, 2), { mode: 0o600 });
}

export const identityPath = () => FILE;
export const identityDir = () => DIR;

export function account(id: Identity) {
  return privateKeyToAccount(id.privateKey);
}
