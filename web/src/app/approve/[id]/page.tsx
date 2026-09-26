"use client";
import { use, useEffect, useState } from "react";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { WalletGate } from "@/components/WalletGate";
import { AddrLink, Button, Card, Notice, Row, Shell, Status, TxLink } from "@/components/ui";
import { summarize } from "@/lib/actions";
import { ADDRESSES } from "@/lib/chain";
import { grantSecretVisa, payViaPassport, readSecretGrant, recordReveal, type Grant } from "@/lib/onchain";
import { blobHash, peelOwnerLayer, typedData } from "@/lib/pap-core";
import { api, signRelay } from "@/lib/relay";
import type { RequestState, SecretMeta } from "@/lib/types";
import { unlock, type StoredWallet } from "@/lib/wallet";

export default function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Shell title="Approve action" back>
      <WalletGate>{(w) => <Approve id={id} w={w} />}</WalletGate>
    </Shell>
  );
}

type SecretView = SecretMeta & { blob?: string };

/** Mirrors AgentPassport.canAct(agentId, scope, 1). */
const usable = (g: Grant) =>
  g.active && (g.expiry === 0n || Number(g.expiry) * 1000 > Date.now()) && (g.limit === 0n || g.spent < g.limit);

function Approve({ id, w }: { id: string; w: StoredWallet }) {
  const [req, setReq] = useState<RequestState | null>();
  const [secret, setSecret] = useState<SecretView | null>();
  const [grant, setGrant] = useState<Grant | null>();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    api<RequestState>(`/api/requests/${id}`)
      .then(async (r) => {
        setReq(r);
        if (r.action.type !== "reveal") return;
        const name = r.action.name;
        api<SecretView>(`/api/secrets/${r.agentAddress}/${name}`).then(setSecret).catch(() => setSecret(null));
        readSecretGrant(BigInt(r.agentId), name).then(setGrant).catch(() => setGrant(null));
      })
      .catch(() => setReq(null));
  }, [id]);

  if (req === undefined) return <p className="text-muted text-sm">Loading…</p>;
  if (req === null) return <Notice kind="error">Request not found.</Notice>;

  const a = req.action;
  const s = summarize(a);
  const mine = req.ownerAddress.toLowerCase() === w.address.toLowerCase();
  const secondsLeft = Math.max(0, Math.floor((req.expiresAt - Date.now()) / 1000));
  const revealBlocked =
    a.type === "reveal" &&
    (secret === null || (secret !== undefined && (secret.status !== "active" || !secret.blob)) || (grant != null && !usable(grant)));

  const resolve = async (status: "approved" | "rejected") => {
    setBusy(true);
    setErr(undefined);
    try {
      setPhase("Face ID…");
      const pk = await unlock(w);
      let txHash = "";
      const extra: { result?: string; approvalSig?: Hex } = {};
      if (status === "approved") {
        const agentId = BigInt(req.agentId);
        if (a.type === "transfer") {
          setPhase("Sending on HSK Chain…");
          txHash = await payViaPassport(pk, agentId, a.token, a.to, a.amount, req.id);
        } else if (a.type === "seal") {
          setPhase("Granting the visa on HSK Chain…");
          txHash = await grantSecretVisa(pk, agentId, a.name, BigInt(a.maxReads), BigInt(a.expiry));
        } else {
          if (!secret?.blob) throw new Error("Sealed secret not available");
          setPhase("Unlocking your layer…");
          const inner = await peelOwnerLayer(secret.blob, pk, { name: a.name, agent: req.agentAddress });
          setPhase("Stamping the read on HSK Chain…");
          txHash = await recordReveal(pk, agentId, a.name, req.id);
          extra.result = inner;
          extra.approvalSig = await privateKeyToAccount(pk).signTypedData(
            typedData(ADDRESSES.AgentPassport!, "RevealApproval", {
              requestId: req.id,
              agent: req.agentAddress,
              name: a.name,
              resultHash: blobHash(inner),
            })
          );
        }
      }
      setPhase("Notifying agent…");
      const payload = { requestId: id, status, txHash, reason: status === "rejected" ? "rejected by owner" : "" };
      const sig = await signRelay(pk, "resolve", payload);
      setReq(
        await api<RequestState>(`/api/requests/${id}/resolve`, { method: "POST", body: JSON.stringify({ ...payload, ...extra, sig }) })
      );
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
        <p className="my-2 text-3xl font-semibold tracking-tight">
          <span className="mr-2">{s.icon}</span>
          {s.title}
        </p>
        {a.type === "transfer" && (
          <>
            <Row k="To" v={<AddrLink addr={a.to} />} />
            {a.memo && <Row k="Memo" v={a.memo} mono={false} />}
            <Row k="Via" v="AgentPassport.pay (visa enforced on-chain)" mono={false} />
          </>
        )}
        {a.type === "reveal" && (
          <>
            <div className="my-3 rounded-2xl border border-accent/40 bg-accent/5 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted">Reason given by the agent</div>
              <div className="mt-1 text-base">“{a.reason}”</div>
            </div>
            <Row
              k="Reads"
              v={grant ? `${grant.spent} of ${grant.limit || "∞"} used` : grant === null ? "no visa" : "…"}
              mono={false}
            />
            {secret?.lastReadAt && <Row k="Last read" v={new Date(secret.lastReadAt).toLocaleString()} mono={false} />}
            <Row k="Unlocks" v="Your layer only (the value stays encrypted to the agent)" mono={false} />
          </>
        )}
        {a.type === "seal" && (
          <>
            <Row k="Max reads" v={a.maxReads} />
            <Row k="Expires" v={new Date(Number(a.expiry) * 1000).toLocaleString()} mono={false} />
            <Row k="Stored as" v="Ciphertext only: your layer + the agent's" mono={false} />
            <Row k="Via" v="AgentPassport.grant (read limit enforced on-chain)" mono={false} />
          </>
        )}
        <Row k="Agent" v={`#${req.agentId} · ${req.agentAddress.slice(0, 8)}…`} />
        {req.status === "pending" && <Row k="Expires in" v={`${secondsLeft}s`} />}
        {req.txHash && <Row k="Transaction" v={<TxLink hash={req.txHash} />} />}
        {req.reason && <Row k="Reason" v={req.reason} mono={false} />}
      </Card>

      {a.type === "reveal" && req.status === "pending" && (
        <Notice>Only approve if the reason makes sense for what you asked your agent to do. Once read, the agent has the value.</Notice>
      )}
      {!mine && <Notice kind="error">This request belongs to another wallet.</Notice>}
      {!ADDRESSES.AgentPassport && <Notice kind="error">Contracts not deployed yet.</Notice>}
      {revealBlocked && req.status === "pending" && (
        <Notice kind="error">This secret can’t be read: it was revoked, expired or used up. Seal it again to continue.</Notice>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      {phase && <Notice>{phase}</Notice>}

      {req.status === "pending" && mine && (
        <>
          <Button onClick={() => resolve("approved")} disabled={busy || !ADDRESSES.AgentPassport || revealBlocked}>
            {busy ? "Working…" : a.type === "reveal" ? "Face ID to allow" : "Approve with Face ID"}
          </Button>
          <Button onClick={() => resolve("rejected")} disabled={busy} variant="danger">
            Reject
          </Button>
        </>
      )}
      {req.status === "approved" && (
        <Notice kind="ok">
          {a.type === "transfer" ? "Sent." : a.type === "seal" ? "Secret sealed." : "Released to your agent."} Your agent has been
          notified and is continuing.
        </Notice>
      )}
    </>
  );
}
