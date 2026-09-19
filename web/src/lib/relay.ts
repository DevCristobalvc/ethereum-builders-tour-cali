"use client";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonical } from "./sig";

export async function signRelay(pk: Hex, kind: string, payload: unknown): Promise<Hex> {
  return privateKeyToAccount(pk).signMessage({ message: canonical(kind, payload) });
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}
