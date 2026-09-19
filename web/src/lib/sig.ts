import { verifyMessage, type Address, type Hex } from "viem";

/** Deterministic message the agent / owner signs over a JSON payload. */
export function canonical(kind: string, payload: unknown): string {
  return `PAP:${kind}:${JSON.stringify(sortKeys(payload))}`;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])])
    );
  }
  return v;
}

export async function verifySig(kind: string, payload: unknown, address: Address, signature: Hex) {
  try {
    return await verifyMessage({ address, message: canonical(kind, payload), signature });
  } catch {
    return false; // malformed signature
  }
}
