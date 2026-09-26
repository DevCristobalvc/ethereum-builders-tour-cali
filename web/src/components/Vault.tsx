"use client";
/** Sealed secrets of every agent this wallet owns: who can read what, how often, until when. Revoke / rotate. */
import { useEffect, useState } from "react";
import { readSecretGrant, revokeVisa, type Grant } from "@/lib/onchain";
import { secretScope } from "@/lib/pap-core";
import { api, signRelay } from "@/lib/relay";
import type { AgentRecord, SecretMeta } from "@/lib/types";
import { unlock, type StoredWallet } from "@/lib/wallet";
import { Button, Card, Notice } from "./ui";

type Row = SecretMeta & { agentName: string; grant?: Grant };

const isLive = (s: Row) => s.status === "active" && (!s.grant || s.grant.active) && Number(s.expiry) * 1000 > Date.now();

export function Vault({ w }: { w: StoredWallet }) {
  const [rows, setRows] = useState<Row[]>();
  const [busy, setBusy] = useState<string>();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string }>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [secrets, agents] = await Promise.all([
          api<SecretMeta[]>(`/api/secrets?owner=${w.address}`),
          api<AgentRecord[]>(`/api/agents?owner=${w.address}`),
        ]);
        const names = new Map(agents.map((a) => [a.agentAddress.toLowerCase(), a.agentName]));
        const enriched = await Promise.all(
          secrets
            .filter((s) => s.status !== "revoked")
            .map(async (s) => ({
              ...s,
              agentName: names.get(s.agentAddress.toLowerCase()) ?? s.agentAddress,
              grant: await readSecretGrant(BigInt(s.agentId), s.name).catch(() => undefined),
            }))
        );
        if (alive) setRows(enriched);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [w.address, tick]);

  const revoke = async (s: Row, rotate: boolean) => {
    if (!confirm(`Revoke "${s.name}" for ${s.agentName}? The agent can't read it anymore.`)) return;
    setBusy(s.name);
    setMsg(undefined);
    try {
      const pk = await unlock(w);
      await revokeVisa(pk, BigInt(s.agentId), secretScope(s.name));
      const payload = { agentAddress: s.agentAddress, name: s.name };
      await api(`/api/secrets/${s.agentAddress}/${s.name}`, {
        method: "DELETE",
        body: JSON.stringify({ sig: await signRelay(pk, "secret-revoke", payload) }),
      });
      setMsg({
        kind: "ok",
        text: rotate
          ? `Revoked. Now rotate the key at the provider and seal the new one from your laptop: pap seal ${s.name}`
          : `Revoked "${s.name}" on-chain and on the relay.`,
      });
      setTick((t) => t + 1);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(undefined);
    }
  };

  if (!rows) return <p className="text-sm text-muted">Loading vault…</p>;

  return (
    <>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {rows.length === 0 ? (
        <Card>
          <h2 className="font-semibold">Vault</h2>
          <p className="mt-1 text-sm text-muted">
            No sealed secrets. On your laptop run <span className="font-mono">pap seal openai</span> — the key is encrypted there and
            only opens with your agent’s signature and your Face ID.
          </p>
        </Card>
      ) : (
        rows.map((s) => {
          const reads = s.grant ? `${s.grant.spent}/${s.grant.limit}` : `${s.reads}/${s.maxReads}`;
          const expires = new Date(Number(s.expiry) * 1000);
          const live = isLive(s);
          return (
            <Card key={`${s.agentAddress}.${s.name}`} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">🔑 {s.name}</h2>
                  <p className="text-xs text-muted">for {s.agentName}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${live ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}
                >
                  {live ? "sealed" : "inactive"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>
                  <b>{reads}</b> <span className="text-muted">reads</span>
                </span>
                <span className="text-muted">until {expires.toLocaleDateString()}</span>
              </div>
              {s.lastReadAt && <p className="text-xs text-muted">Last read {new Date(s.lastReadAt).toLocaleString()}</p>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="danger" disabled={busy === s.name} onClick={() => revoke(s, false)}>
                  {busy === s.name ? "Working…" : "Revoke"}
                </Button>
                <Button variant="ghost" disabled={busy === s.name} onClick={() => revoke(s, true)}>
                  Rotate
                </Button>
              </div>
            </Card>
          );
        })
      )}
    </>
  );
}
