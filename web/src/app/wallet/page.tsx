"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther, formatUnits } from "viem";
import { WalletGate } from "@/components/WalletGate";
import { AddrLink, Button, Card, Notice, Row, Shell, Status, short } from "@/components/ui";
import { ADDRESSES, DEMO_TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/chain";
import { gasBalance, tokenBalance } from "@/lib/onchain";
import { api } from "@/lib/relay";
import type { RequestState } from "@/lib/types";
import { clearWallet, type StoredWallet } from "@/lib/wallet";

export default function Home() {
  return (
    <Shell>
      <WalletGate>{(w) => <Dashboard w={w} />}</WalletGate>
      <p className="text-center text-xs text-muted">
        Built at Ethereum Builders Tour Cali · HSK Chain testnet
      </p>
    </Shell>
  );
}

function Dashboard({ w }: { w: StoredWallet }) {
  const [gas, setGas] = useState<bigint>();
  const [usdt, setUsdt] = useState<bigint>();
  const [reqs, setReqs] = useState<RequestState[]>([]);
  const [err, setErr] = useState<string>();

  const refresh = async () => {
    try {
      const [g, r] = await Promise.all([gasBalance(w.address), api<RequestState[]>(`/api/requests?owner=${w.address}`)]);
      setGas(g);
      setReqs(r);
      if (ADDRESSES.DemoUSDT) setUsdt(await tokenBalance(w.address));
    } catch (e) {
      setErr((e as Error).message);
    }
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
          <span className="rounded-full border border-ok px-2 py-0.5 text-[10px] uppercase text-ok">
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
            <Link key={r.id} href={`/approve/${r.id}`} className="rounded-xl border border-accent/50 p-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{r.agentName}</span>
                <Status s={r.status} />
              </div>
              <div className="text-sm text-muted">
                Send <b className="text-foreground">{r.action.amount} {TOKEN_SYMBOL}</b> to {short(r.action.to)}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {history.length > 0 && (
        <Card>
          <h2 className="font-semibold">History</h2>
          <div className="mt-2 flex flex-col divide-y divide-border">
            {history.map((r) => (
              <Link key={r.id} href={`/approve/${r.id}`} className="flex justify-between py-2 text-sm">
                <span>
                  {r.action.amount} {TOKEN_SYMBOL} → {short(r.action.to)}
                </span>
                <Status s={r.status} />
              </Link>
            ))}
          </div>
        </Card>
      )}

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
    </>
  );
}
