"use client";
import { use, useEffect, useState } from "react";
import { WalletGate } from "@/components/WalletGate";
import { AddrLink, Button, Card, Notice, Row, Shell, Status, TxLink } from "@/components/ui";
import { ADDRESSES, TOKEN_SYMBOL } from "@/lib/chain";
import { payViaPassport } from "@/lib/onchain";
import { api, signRelay } from "@/lib/relay";
import type { RequestState } from "@/lib/types";
import { unlock, type StoredWallet } from "@/lib/wallet";

export default function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Shell title="Approve action" back>
      <WalletGate>{(w) => <Approve id={id} w={w} />}</WalletGate>
    </Shell>
  );
}

function Approve({ id, w }: { id: string; w: StoredWallet }) {
  const [req, setReq] = useState<RequestState | null>();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    api<RequestState>(`/api/requests/${id}`).then(setReq).catch(() => setReq(null));
  }, [id]);

  if (req === undefined) return <p className="text-muted text-sm">Loading…</p>;
  if (req === null) return <Notice kind="error">Request not found.</Notice>;

  const mine = req.ownerAddress.toLowerCase() === w.address.toLowerCase();
  const secondsLeft = Math.max(0, Math.floor((req.expiresAt - Date.now()) / 1000));

  const resolve = async (status: "approved" | "rejected") => {
    setBusy(true);
    setErr(undefined);
    try {
      setPhase("Face ID…");
      const pk = await unlock(w);
      let txHash = "";
      if (status === "approved") {
        setPhase("Sending on HSK Chain…");
        txHash = await payViaPassport(pk, BigInt(req.agentId), req.action.token, req.action.to, req.action.amount, req.id);
      }
      setPhase("Notifying agent…");
      const payload = { requestId: id, status, txHash, reason: status === "rejected" ? "rejected by owner" : "" };
      const sig = await signRelay(pk, "resolve", payload);
      setReq(await api<RequestState>(`/api/requests/${id}/resolve`, { method: "POST", body: JSON.stringify({ ...payload, sig }) }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setPhase(undefined);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{req.agentName}</h2>
          <Status s={req.status} />
        </div>
        <p className="mt-1 text-sm text-muted">wants to</p>
        <p className="my-2 text-2xl font-semibold">
          Send {req.action.amount} {TOKEN_SYMBOL}
        </p>
        <Row k="To" v={<AddrLink addr={req.action.to} />} />
        {req.action.memo && <Row k="Memo" v={req.action.memo} mono={false} />}
        <Row k="Agent" v={`#${req.agentId} · ${req.agentAddress.slice(0, 8)}…`} />
        <Row k="Via" v="AgentPassport.pay (visa enforced on-chain)" mono={false} />
        {req.status === "pending" && <Row k="Expires in" v={`${secondsLeft}s`} />}
        {req.txHash && <Row k="Transaction" v={<TxLink hash={req.txHash} />} />}
        {req.reason && <Row k="Reason" v={req.reason} mono={false} />}
      </Card>

      {!mine && <Notice kind="error">This request belongs to another wallet.</Notice>}
      {!ADDRESSES.AgentPassport && <Notice kind="error">Contracts not deployed yet.</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {phase && <Notice>{phase}</Notice>}

      {req.status === "pending" && mine && (
        <>
          <Button onClick={() => resolve("approved")} disabled={busy || !ADDRESSES.AgentPassport}>
            {busy ? "Working…" : "Approve with Face ID"}
          </Button>
          <Button onClick={() => resolve("rejected")} disabled={busy} variant="danger">
            Reject
          </Button>
        </>
      )}
      {req.status === "approved" && <Notice kind="ok">Sent. Your agent has been notified and is continuing.</Notice>}
    </>
  );
}
