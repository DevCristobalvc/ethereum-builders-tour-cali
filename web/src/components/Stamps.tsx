"use client";
/** Passport stamps: every payment (Paid) and every secret read (ActionRecorded) read from HSK Chain. */
import { useEffect, useState } from "react";
import { formatUnits, type Hex } from "viem";
import { DEMO_TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/chain";
import { readSecretStamps, readStamps } from "@/lib/onchain";
import { secretScope } from "@/lib/pap-core";
import { api } from "@/lib/relay";
import type { AgentRecord, SecretMeta } from "@/lib/types";
import { Card, TxLink, short } from "./ui";

type Entry = { key: string; block: bigint; icon: string; text: string; agent: string; byYou: boolean; txHash: Hex };

export function Stamps({ owner }: { owner: string }) {
  const [entries, setEntries] = useState<Entry[]>();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [agents, secrets] = await Promise.all([
          api<AgentRecord[]>(`/api/agents?owner=${owner}`),
          api<SecretMeta[]>(`/api/secrets?owner=${owner}`),
        ]);
        const me = owner.toLowerCase();
        const all = await Promise.all(
          agents
            .filter((a) => a.agentId)
            .map(async (a) => {
              const id = BigInt(a.agentId);
              const names = secrets.filter((s) => s.agentAddress.toLowerCase() === a.agentAddress.toLowerCase()).map((s) => s.name);
              const byScope = new Map(names.map((n) => [secretScope(n), n]));
              const [paid, reads] = await Promise.all([
                readStamps(id).catch(() => []),
                readSecretStamps(id, [...byScope.keys()]).catch(() => []),
              ]);
              return [
                ...paid.map<Entry>((p) => ({
                  key: `p${p.txHash}`,
                  block: p.block,
                  icon: "💸",
                  text: `${formatUnits(p.amount, DEMO_TOKEN_DECIMALS)} ${TOKEN_SYMBOL} → ${short(p.to)}`,
                  agent: a.agentName,
                  byYou: p.by.toLowerCase() === me,
                  txHash: p.txHash,
                })),
                ...reads.map<Entry>((r) => ({
                  key: `r${r.txHash}`,
                  block: r.block,
                  icon: "🔑",
                  text: `read “${byScope.get(r.scope) ?? "secret"}”`,
                  agent: a.agentName,
                  byYou: r.by.toLowerCase() === me,
                  txHash: r.txHash,
                })),
              ];
            })
        );
        if (alive) setEntries(all.flat().sort((x, y) => (x.block < y.block ? 1 : -1)));
      } catch {
        if (alive) setEntries([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [owner]);

  return (
    <Card>
      <h2 className="font-semibold">Passport stamps</h2>
      <p className="text-xs text-muted">Read from HSK Chain — every payment and every secret read you approved.</p>
      {!entries ? (
        <p className="mt-2 text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No stamps yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {entries.slice(0, 30).map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                {e.icon} {e.text}
                <span className="ml-1 text-xs text-muted">
                  · {e.agent} · {e.byYou ? "you" : "agent"}
                </span>
              </span>
              <TxLink hash={e.txHash} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
