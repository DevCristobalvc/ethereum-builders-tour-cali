"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther, formatUnits } from "viem";
import { Agents } from "@/components/Agents";
import { Stamps } from "@/components/Stamps";
import { Vault } from "@/components/Vault";
import { WalletGate } from "@/components/WalletGate";
import { AddrLink, Button, Card, Notice, Row, Shell, Status } from "@/components/ui";
import { ADDRESSES, DEMO_TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/chain";
import { gasBalance, tokenBalance } from "@/lib/onchain";
import { summarize } from "@/lib/actions";
import { api } from "@/lib/relay";
import type { RequestState } from "@/lib/types";
import { clearWallet, type StoredWallet } from "@/lib/wallet";

export default function Home() {
  return (
    <Shell title="Wallet">
      <WalletGate>{(w) => <Dashboard w={w} />}</WalletGate>
      <p className="text-center text-xs text-muted">
        Ethereum Builders Tour Cali · HSK Chain testnet
      </p>
    </Shell>
  );
}

function Dashboard({ w }: { w: StoredWallet }) {
  const [gas, setGas] = useState<bigint>();
  const [usdt, setUsdt] = useState<bigint>();
  const [reqs, setReqs] = useState<RequestState[]>([]);
  const [err, setErr] = useState<string>();
  const [tab, setTab] = useState<Tab>("agents");

  const refresh = async () => {
    // Independent reads: a flaky RPC must not hide pending approvals from the relay.
    const [g, r, u] = await Promise.allSettled([
      gasBalance(w.address),
      api<RequestState[]>(`/api/requests?owner=${w.address}`),
      ADDRESSES.DemoUSDT ? tokenBalance(w.address) : Promise.resolve(undefined),
    ]);
    if (g.status === "fulfilled") setGas(g.value);
    if (r.status === "fulfilled") setReqs(r.value);
    if (u.status === "fulfilled") setUsdt(u.value);
    const failed = [g, r, u].find((x) => x.status === "rejected") as PromiseRejectedResult | undefined;
    setErr(failed ? String((failed.reason as Error)?.message ?? failed.reason).split("\n")[0] : undefined);
  };
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.address]);

  const pending = reqs.filter((r) => r.status === "pending" && r.expiresAt > Date.now());
  const history = reqs.filter((r) => r.status !== "pending").slice(0, 10);

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your wallet</h2>
          <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ok">
            {w.prf ? "passkey · encrypted" : "passkey"}
          </span>
        </div>
        <Row k="Address" v={<AddrLink addr={w.address} />} />
        <Row k="Gas" v={gas === undefined ? "…" : `${Number(formatEther(gas)).toFixed(4)} HSK`} />
        <Row k={TOKEN_SYMBOL} v={usdt === undefined ? "…" : formatUnits(usdt, DEMO_TOKEN_DECIMALS)} />
        {gas === 0n && <Notice>No gas yet. Reload in a few seconds (sponsor) or use the HSK faucet.</Notice>}
      </Card>

      <Card>
        <h2 className="font-semibold">Pending approvals {pending.length > 0 && <span className="text-accent">· {pending.length}</span>}</h2>
        {pending.length === 0 && <p className="text-sm text-muted mt-1">Nothing waiting. Ask your agent to do something.</p>}
        <div className="mt-2 flex flex-col gap-2">
          {pending.map((r) => (
            <Link key={r.id} href={`/approve/${r.id}`} className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{r.agentName}</span>
                <Status s={r.status} />
              </div>
              <div className="text-sm text-muted">
                {summarize(r.action).icon} <b className="text-foreground">{summarize(r.action).title}</b> {summarize(r.action).detail}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {tab === "agents" && (
        <>
          <Agents owner={w.address} />
          {history.length > 0 && (
            <Card>
              <h2 className="font-semibold">History</h2>
              <div className="mt-2 flex flex-col divide-y divide-border">
                {history.map((r) => (
                  <Link key={r.id} href={`/approve/${r.id}`} className="flex justify-between py-2 text-sm">
                    <span>
                      {summarize(r.action).icon} {summarize(r.action).title}
                    </span>
                    <Status s={r.status} />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
      {tab === "vault" && <Vault w={w} />}
      {tab === "stamps" && <Stamps owner={w.address} />}

      {err && <Notice kind="error">{err}</Notice>}
      <Button
        variant="ghost"
        onClick={() => {
          if (confirm("Delete this wallet from the phone? Funds on it will be lost.")) {
            clearWallet();
            location.reload();
          }
        }}
      >
        Reset wallet
      </Button>
      <TabBar tab={tab} onChange={setTab} pending={pending.length} />
    </>
  );
}

type Tab = "agents" | "vault" | "stamps";

/** Thumb-reachable bottom navigation for the three views of the passport. */
function TabBar({ tab, onChange, pending }: { tab: Tab; onChange: (t: Tab) => void; pending: number }) {
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: "agents", icon: "🤖", label: "Agents" },
    { id: "vault", icon: "🔑", label: "Vault" },
    { id: "stamps", icon: "🛂", label: "Stamps" },
  ];
  return (
    <>
      <div className="h-16" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              aria-current={tab === it.id ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${tab === it.id ? "text-foreground" : "text-muted"}`}
            >
              <span className="text-lg leading-none">{it.icon}</span>
              {it.label}
              {it.id === "agents" && pending > 0 && <span className="sr-only">{pending} pending</span>}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
