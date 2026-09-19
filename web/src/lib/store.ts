/**
 * Relay state on Vercel Blob. Every state change is a NEW immutable blob under
 * `pap/<kind>/<id>/<seq>.json`; the latest one wins. This sidesteps CDN caching
 * (a fresh URL is never cached) and needs no database.
 */
import { put, list } from "@vercel/blob";

export type Kind = "pair" | "request" | "agent";

const prefix = (kind: Kind, id: string) => `pap/${kind}/${id}/`;

export async function write<T extends object>(kind: Kind, id: string, state: T): Promise<T> {
  const seq = Date.now().toString().padStart(14, "0");
  await put(`${prefix(kind, id)}${seq}.json`, JSON.stringify(state), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
  });
  return state;
}

export async function read<T>(kind: Kind, id: string): Promise<T | null> {
  const { blobs } = await list({ prefix: prefix(kind, id), limit: 100 });
  if (!blobs.length) return null;
  const latest = blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1))[0];
  const res = await fetch(latest.url, { cache: "no-store" });
  return (await res.json()) as T;
}

/** Latest state of every item of a kind (small scale only — demo). */
export async function readAll<T>(kind: Kind, max = 200): Promise<T[]> {
  const { blobs } = await list({ prefix: `pap/${kind}/`, limit: 1000 });
  const byId = new Map<string, (typeof blobs)[number]>();
  for (const b of blobs) {
    const id = b.pathname.split("/")[2];
    const cur = byId.get(id);
    if (!cur || b.pathname > cur.pathname) byId.set(id, b);
  }
  const latest = [...byId.values()].sort((a, b) => (a.pathname < b.pathname ? 1 : -1)).slice(0, max);
  return Promise.all(latest.map(async (b) => (await fetch(b.url, { cache: "no-store" })).json() as Promise<T>));
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
