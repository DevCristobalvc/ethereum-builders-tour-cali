"use client";
/** Live numbers straight from HSK Chain: registered agents, passport stamps, demoUSDT moved. */
import { useEffect, useState } from "react";
import { formatUnits, parseAbiItem } from "viem";
import { ABI, ADDRESSES } from "@/lib/chain";
import { pub } from "@/lib/onchain";

const DEPLOY_BLOCK = 33334362n;

export function LiveStats() {
  const [s, setS] = useState<{ agents: bigint; stamps: number; volume: bigint } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!ADDRESSES.IdentityRegistry || !ADDRESSES.AgentPassport) return;
      try {
        const [agents, logs] = await Promise.all([
          pub.readContract({ address: ADDRESSES.IdentityRegistry, abi: ABI.IdentityRegistry, functionName: "totalAgents" }) as Promise<bigint>,
          pub.getLogs({
            address: ADDRESSES.AgentPassport,
            event: parseAbiItem("event Paid(uint256 indexed agentId, address indexed token, address indexed to, uint256 amount, bytes32 ref, address by)"),
            fromBlock: DEPLOY_BLOCK,
            toBlock: "latest",
          }),
        ]);
        if (alive) setS({ agents, stamps: logs.length, volume: logs.reduce((a, l) => a + (l.args.amount ?? 0n), 0n) });
      } catch {}
    };
    load();
    const t = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const items = [
    { k: "Agents registered", v: s ? s.agents.toString() : "—" },
    { k: "Passport stamps", v: s ? String(s.stamps) : "—" },
    { k: "demoUSDT moved", v: s ? formatUnits(s.volume, 6) : "—" },
    { k: "Gas per visa", v: "< 0.001 HSK" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
      {items.map((i) => (
        <div key={i.k} className="bg-surface p-5">
          <dt className="font-cond text-[12px] uppercase tracking-[0.18em] text-muted">{i.k}</dt>
          <dd className="mt-1 font-serif text-4xl font-medium tabular-nums text-foreground">{i.v}</dd>
        </div>
      ))}
      <p className="col-span-2 bg-surface px-5 py-2 text-[11px] text-muted md:col-span-4">
        Live from HSK Chain testnet · updates every 20s
      </p>
    </dl>
  );
}
