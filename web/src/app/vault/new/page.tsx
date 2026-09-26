"use client";
/** Seal a credential from the phone (or any browser with the wallet): encrypted here, one Face ID activates it. */
import { useEffect, useState } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { WalletGate } from "@/components/WalletGate";
import { Button, Card, Label, Notice, Shell, inputCls } from "@/components/ui";
import { ADDRESSES } from "@/lib/chain";
import { grantSecretVisa } from "@/lib/onchain";
import { blobHash, sealSecret, SECRET_NAME, typedData } from "@/lib/pap-core";
import { api } from "@/lib/relay";
import type { AgentRecord } from "@/lib/types";
import { unlock, type StoredWallet } from "@/lib/wallet";

export default function NewSecretPage() {
  return (
    <Shell title="Seal a secret" back>
      <WalletGate>{(w) => <NewSecret w={w} />}</WalletGate>
    </Shell>
  );
}

const newNonce = () => crypto.randomUUID().replace(/-/g, "");

function NewSecret({ w }: { w: StoredWallet }) {
  const [agents, setAgents] = useState<AgentRecord[]>();
  const [agent, setAgent] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [maxReads, setMaxReads] = useState("10");
  const [days, setDays] = useState("7");
  const [phase, setPhase] = useState<string>();
  const [err, setErr] = useState<string>();
  const [done, setDone] = useState<string>();

  useEffect(() => {
    api<AgentRecord[]>(`/api/agents?owner=${w.address}`)
      .then((a) => {
        setAgents(a);
        if (a[0]) setAgent(a[0].agentAddress);
      })
      .catch(() => setAgents([]));
  }, [w.address]);

  const target = agents?.find((a) => a.agentAddress === agent);
  const valid = target && SECRET_NAME.test(name) && value.length > 0 && Number(maxReads) >= 1 && Number(days) > 0;

  const seal = async () => {
    if (!target) return;
    setErr(undefined);
    try {
      if (!target.agentPublicKey)
        throw new Error("The relay doesn't know this agent's public key yet: ask your agent to run pap_secrets_list once, then retry.");
      setPhase("Face ID…");
      const pk = await unlock(w);
      const me = privateKeyToAccount(pk);
      setPhase("Encrypting on this device…");
      const blob = await sealSecret(value, { name, agent: target.agentAddress, agentPub: target.agentPublicKey, ownerPub: me.publicKey });
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Math.round(Number(days) * 86400));
      setPhase("Granting the visa on HSK Chain…");
      const grantTx = await grantSecretVisa(pk, BigInt(target.agentId), name, BigInt(maxReads), expiry);
      const msg = { agent: target.agentAddress, name, blobHash: blobHash(blob), maxReads: BigInt(maxReads), expiry, nonce: newNonce() };
      const sig = await me.signTypedData(typedData(ADDRESSES.AgentPassport!, "SealRequest", msg));
      setPhase("Storing ciphertext…");
      await api("/api/secrets", {
        method: "POST",
        body: JSON.stringify({ agentAddress: target.agentAddress, name, blob, maxReads, expiry: expiry.toString(), nonce: msg.nonce, grantTx, sig }),
      });
      setValue("");
      setDone(`🔒 Sealed for ${target.agentName}. Not even the server can read it.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPhase(undefined);
    }
  };

  if (!agents) return <p className="text-sm text-muted">Loading…</p>;
  if (agents.length === 0) return <Notice>No agents yet. Connect one with pap_connect first.</Notice>;

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div>
          <Label>Agent</Label>
          <select className={inputCls} value={agent} onChange={(e) => setAgent(e.target.value)}>
            {agents.map((a) => (
              <option key={a.agentAddress} value={a.agentAddress}>
                {a.agentName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Name</Label>
          <input className={inputCls} placeholder="openai" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} autoCapitalize="none" />
        </div>
        <div>
          <Label>Secret</Label>
          <input
            className={inputCls}
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Max reads</Label>
            <input className={inputCls} inputMode="numeric" value={maxReads} onChange={(e) => setMaxReads(e.target.value)} />
          </div>
          <div>
            <Label>Days</Label>
            <input className={inputCls} inputMode="decimal" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted">
          Encrypted on this device for your agent and for you. It opens only when the agent asks and you approve with Face ID. Once
          read, the agent has the value — prefer short-lived, limited keys.
        </p>
      </Card>
      {err && <Notice kind="error">{err}</Notice>}
      {phase && <Notice>{phase}</Notice>}
      {done && <Notice kind="ok">{done}</Notice>}
      <Button onClick={seal} disabled={!valid || Boolean(phase)}>
        {phase ? "Working…" : "Seal with Face ID"}
      </Button>
    </>
  );
}
