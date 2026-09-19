import { exec } from "node:child_process";
import type { Address, Hex } from "viem";
import { account, type Identity } from "./identity.js";

/** Must match web/src/lib/sig.ts */
export function canonical(kind: string, payload: unknown): string {
  return `PAP:${kind}:${JSON.stringify(sortKeys(payload))}`;
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])])
    );
  return v;
}

export async function sign(id: Identity, kind: string, payload: unknown): Promise<Hex> {
  return account(id).signMessage({ message: canonical(kind, payload) });
}

export async function call<T>(id: Identity, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${id.relay}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `relay ${res.status} on ${path}`);
  return data;
}

export type PairState = { id: string; status: "pending" | "approved" | "rejected"; ownerAddress?: Address; agentId?: string; txHash?: Hex };
export type RequestState = {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  txHash?: Hex;
  reason?: string;
  expiresAt: number;
  action: { type: "transfer"; token: Address; to: Address; amount: string; memo?: string };
};

/** Poll until the state leaves `pending` or `maxMs` elapses. */
export async function waitFor<T extends { status: string }>(
  id: Identity,
  path: string,
  maxMs: number,
  onTick?: (s: T, elapsed: number) => void
): Promise<T> {
  const start = Date.now();
  let last: T | undefined;
  while (Date.now() - start < maxMs) {
    last = await call<T>(id, path).catch(() => last);
    if (last && last.status !== "pending") return last;
    onTick?.(last as T, Date.now() - start);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last as T;
}

/** Open the big-QR page on the laptop screen (best effort, never throws). */
export function openBrowser(url: string) {
  if (process.env.PAP_NO_BROWSER) return;
  const cmd =
    process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

export const explorerTx = (hash: string) => `https://testnet-explorer.hskchain.net/tx/${hash}`;
