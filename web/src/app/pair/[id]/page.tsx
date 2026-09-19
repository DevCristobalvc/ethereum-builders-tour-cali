"use client";
import { use, useEffect, useState } from "react";
import { WalletGate } from "@/components/WalletGate";
import { AddrLink, Button, Card, Notice, Row, Shell, Status, TxLink } from "@/components/ui";
import { ADDRESSES, TOKEN_SYMBOL } from "@/lib/chain";
import { onboardAgent, type Step } from "@/lib/onchain";
import { api, signRelay } from "@/lib/relay";
import type { PairState } from "@/lib/types";
import { unlock, type StoredWallet } from "@/lib/wallet";

export default function PairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Shell title="Connect agent" back>
      <WalletGate>{(w) => <Pair id={id} w={w} />}</WalletGate>
    </Shell>
  );
}

function Pair({ id, w }: { id: string; w: StoredWallet }) {
  const [pair, setPair] = useState<PairState | null>();
  const [limit, setLimit] = useState("100");
  const [days, setDays] = useState("7");
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    api<PairState>(`/api/pair/${id}`).then(setPair).catch(() => setPair(null));
  }, [id]);

  if (pair === undefined) return <p className="text-muted text-sm">Loading…</p>;
  if (pair === null) return <Notice kind="error">Pairing not found.</Notice>;

  const approve = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      const pk = await unlock(w); // Face ID
      const agentURI = `${location.origin}/api/agents/${pair.agentAddress}/card`;
      const { agentId, steps } = await onboardAgent(pk, pair.agentAddress, agentURI, limit, Number(days), setSteps);
      const payload = { pairId: id, ownerAddress: w.address, agentId: agentId.toString(), txHash: steps[0].hash ?? "", status: "approved" };
      const sig = await signRelay(pk, "pair-approve", payload);
      setPair(await api<PairState>(`/api/pair/${id}/approve`, { method: "POST", body: JSON.stringify({ ...payload, sig }) }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      const pk = await unlock(w);
      const payload = { pairId: id, ownerAddress: w.address, agentId: "", txHash: "", status: "rejected" };
      const sig = await signRelay(pk, "pair-approve", payload);
      setPair(await api<PairState>(`/api/pair/${id}/approve`, { method: "POST", body: JSON.stringify({ ...payload, sig }) }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{pair.agentName}</h2>
          <Status s={pair.status} />
        </div>
        <p className="text-sm text-muted mt-1">wants to become your agent.</p>
        <Row k="Agent key" v={<AddrLink addr={pair.agentAddress} />} />
        <Row k="Your wallet" v={<AddrLink addr={w.address} />} />
        {pair.agentId && <Row k="ERC-8004 agentId" v={`#${pair.agentId}`} />}
        {pair.txHash && <Row k="Registration" v={<TxLink hash={pair.txHash} />} />}
      </Card>

      {pair.status === "pending" && (
        <Card className="flex flex-col gap-3">
          <h3 className="font-semibold">Visa for this agent</h3>
          <p className="text-sm text-muted">
            The agent may ask you to send {TOKEN_SYMBOL}. Every request still needs your Face ID; this is the hard cap
            enforced on-chain.
          </p>
          <label className="text-sm">
            <span className="text-muted">Max total {TOKEN_SYMBOL}</span>
            <input
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono"
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted">Valid for (days)</span>
            <input
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </label>
          {!ADDRESSES.AgentPassport && <Notice kind="error">Contracts not deployed yet.</Notice>}
          {err && <Notice kind="error">{err}</Notice>}
          <Button onClick={approve} disabled={busy || !ADDRESSES.AgentPassport}>
            {busy ? "Working…" : "Approve with Face ID"}
          </Button>
          <Button onClick={reject} disabled={busy} variant="danger">
            Reject
          </Button>
        </Card>
      )}

      {steps.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">On-chain steps</h3>
          <ol className="flex flex-col gap-1.5 text-sm">
            {steps.map((s, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className={s.done ? "text-ok" : s.hash ? "text-accent" : "text-muted"}>
                  {s.done ? "✓" : s.hash ? "…" : "○"} {s.label}
                </span>
                {s.hash && <TxLink hash={s.hash} />}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {pair.status === "approved" && (
        <Notice kind="ok">Agent connected. You can go back to your terminal — the agent already knows.</Notice>
      )}
    </>
  );
}
