"use client";
/** Ensures the phone has a passkey-protected wallet before rendering children. */
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createWallet, passkeySupported, storedWalletRaw, type StoredWallet } from "@/lib/wallet";
import { Button, Card, Notice } from "./ui";

const noSubscribe = () => () => {};

export function WalletGate({ children }: { children: (w: StoredWallet) => ReactNode }) {
  // undefined while rendering on the server, then whatever localStorage holds.
  const raw = useSyncExternalStore(noSubscribe, storedWalletRaw, () => undefined);
  const [created, setCreated] = useState<StoredWallet | null>(null);
  const wallet = useMemo(() => created ?? (raw === undefined ? undefined : raw ? (JSON.parse(raw) as StoredWallet) : null), [raw, created]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (wallet === undefined) return <p className="text-muted text-sm">Loading…</p>;
  if (wallet) return <>{children(wallet)}</>;

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const w = await createWallet();
      // Sponsor a little gas so the first on-chain actions work without a faucet.
      fetch("/api/fund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: w.address }) }).catch(() => {});
      setCreated(w);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">Set up your passport wallet</h2>
      <p className="text-sm text-muted">
        A wallet is created on this phone and locked behind a passkey (Face ID). Your AI agent never sees it — it
        only gets what you approve.
      </p>
      {!passkeySupported() && <Notice kind="error">This browser does not support passkeys. Use Safari on iPhone.</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      <Button onClick={create} disabled={busy || !passkeySupported()}>
        {busy ? "Creating…" : "Create with Face ID"}
      </Button>
    </Card>
  );
}
