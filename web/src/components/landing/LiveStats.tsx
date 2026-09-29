"use client";
/** Live numbers straight from HSK Chain: registered agents, passport stamps, demoUSDT moved. viem loads only once the block is on screen. */
import { useEffect, useState } from "react";
import { useInView } from "./motion";

type Stats = { agents: bigint; stamps: number; volume: string };

async function fetchStats(): Promise<Stats | null> {
  const [{ formatUnits, parseAbiItem }, { ABI, ADDRESSES }, { pub }, { eventLogs }] = await Promise.all([
    import("viem"),
    import("@/lib/chain"),
    import("@/lib/onchain"),
    import("@/lib/logs"),
  ]);
  if (!ADDRESSES.IdentityRegistry || !ADDRESSES.AgentPassport) return null;
  const [agents, logs] = await Promise.all([
    pub.readContract({ address: ADDRESSES.IdentityRegistry, abi: ABI.IdentityRegistry, functionName: "totalAgents" }) as Promise<bigint>,
    eventLogs<{ amount: bigint }>(ADDRESSES.AgentPassport, parseAbiItem("event Paid(uint256 indexed agentId, address indexed token, address indexed to, uint256 amount, bytes32 ref, address by)")),
  ]);
  return { agents, stamps: logs.length, volume: formatUnits(logs.reduce((a, l) => a + (l.args.amount ?? 0n), 0n), 6) };
}

export function LiveStats() {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "200px" });
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    if (!inView) return;
    let alive = true;
    const load = () =>
      fetchStats()
        .then((r) => alive && r && setS(r))
        .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [inView]);

  const items = [
    { k: "Agents registered", v: s ? s.agents.toString() : "—" },
    { k: "Passport stamps", v: s ? String(s.stamps) : "—" },
    { k: "demoUSDT moved", v: s ? s.volume : "—" },
    { k: "Gas per visa", v: "< 0.001 HSK" },
  ];
  return (
    <div ref={ref} className="overflow-hidden rounded-sm border border-border bg-border">
      <dl className="grid grid-cols-2 gap-px md:grid-cols-4">
        {items.map((i) => (
          <div key={i.k} className="bg-surface p-5">
            <dt className="text-[13px] text-muted">{i.k}</dt>
            <dd className="mt-1 font-serif text-4xl font-semibold tabular-nums text-foreground">{i.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-px bg-surface px-5 py-2 text-[11px] text-muted">Live from HSK Chain testnet, refreshed every 20 s</p>
    </div>
  );
}
