"use client";
/** Paired agents with their on-chain payment visa and how many secrets each can ask for. */
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { ADDRESSES, DEMO_TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/chain";
import { readGrant, type Grant } from "@/lib/onchain";
import { api } from "@/lib/relay";
import type { AgentRecord, SecretMeta } from "@/lib/types";
import { AddrLink, Card } from "./ui";

type Row = AgentRecord & { grant?: Grant; secrets?: number };

export function Agents({ owner }: { owner: string }) {
  const [rows, setRows] = useState<Row[]>();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [agents, secrets] = await Promise.all([
          api<AgentRecord[]>(`/api/agents?owner=${owner}`),
          api<SecretMeta[]>(`/api/secrets?owner=${owner}`).catch(() => [] as SecretMeta[]),
        ]);
        const token = ADDRESSES.DemoUSDT;
        const enriched = await Promise.all(
          agents.map(async (a) => {
            const count = secrets.filter((s) => s.status === "active" && s.agentAddress.toLowerCase() === a.agentAddress.toLowerCase()).length;
            if (!token || !a.agentId) return { ...a, secrets: count } as Row;
            const grant = await readGrant(BigInt(a.agentId), token).catch(() => undefined);
            return { ...a, grant, secrets: count } as Row;
          })
        );
        if (alive) setRows(enriched);
      } catch {
        if (alive) setRows([]);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [owner]);

  if (!rows) return null;
  if (rows.length === 0)
    return (
      <Card>
        <h2 className="font-semibold">Your agents</h2>
        <p className="mt-1 text-sm text-muted">None yet. Run <span className="font-mono">pap_connect</span> in your agent and scan the QR.</p>
      </Card>
    );

  const fmt = (v: bigint) => formatUnits(v, DEMO_TOKEN_DECIMALS);

  return (
    <>
      {rows.map((a) => {
        const g = a.grant;
        const active = g?.active && Number(g.expiry) * 1000 > Date.now();
        const pct = g && g.limit > 0n ? Number((g.spent * 100n) / g.limit) : 0;
        return (
          <Card key={a.agentAddress} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{a.agentName}</h2>
                <p className="text-xs text-muted">
                  ERC-8004 #{a.agentId} · <AddrLink addr={a.agentAddress} />
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${active ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}
              >
                {active ? "visa active" : "no visa"}
              </span>
            </div>

            {g && (
              <div>
                <div className="flex justify-between text-sm">
                  <span>
                    <b>{fmt(g.limit - g.spent)}</b> <span className="text-muted">of {fmt(g.limit)} {TOKEN_SYMBOL} left</span>
                  </span>
                  <span className="text-muted">until {new Date(Number(g.expiry) * 1000).toLocaleDateString()}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            )}

            <p className="text-sm text-muted">
              🔑 {a.secrets ? `${a.secrets} sealed secret${a.secrets > 1 ? "s" : ""} it can ask for` : "no sealed secrets"}
            </p>
          </Card>
        );
      })}
    </>
  );
}
