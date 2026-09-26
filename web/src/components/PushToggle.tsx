"use client";
/** Offer push notifications so approvals reach the phone without scanning a QR. */
import { useEffect, useState } from "react";
import { api, signRelay } from "@/lib/relay";
import { unlock, type StoredWallet } from "@/lib/wallet";
import { Button, Notice } from "./ui";

type State = "unsupported" | "needs-install" | "off" | "on" | "disabled";

function b64ToBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function detect(): Promise<{ state: State; key?: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return { state: "unsupported" };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!("PushManager" in window)) return { state: ios && !standalone ? "needs-install" : "unsupported" };
  const cfg = await api<{ enabled: boolean; publicKey: string | null }>("/api/push/subscribe").catch(() => null);
  if (!cfg?.enabled || !cfg.publicKey) return { state: "disabled" };
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const sub = await reg.pushManager.getSubscription();
  return { state: sub ? "on" : "off", key: cfg.publicKey };
}

export function PushToggle({ w }: { w: StoredWallet }) {
  const [st, setSt] = useState<{ state: State; key?: string }>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    detect()
      .then(setSt)
      .catch(() => setSt({ state: "unsupported" }));
  }, []);

  if (!st || st.state === "unsupported" || st.state === "disabled" || st.state === "on") return null;
  if (st.state === "needs-install")
    return <Notice>Get approvals as notifications: tap Share → “Add to Home Screen”, then open PAP from your home screen.</Notice>;

  const enable = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications were not allowed.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(st.key!) });
      const pk = await unlock(w);
      const subscription = sub.toJSON();
      const sig = await signRelay(pk, "push-subscribe", { owner: w.address, endpoint: subscription.endpoint });
      await api("/api/push/subscribe", { method: "POST", body: JSON.stringify({ owner: w.address, subscription, sig }) });
      setSt({ ...st, state: "on" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={enable} disabled={busy}>
        {busy ? "Enabling…" : "🔔 Get approvals as notifications"}
      </Button>
      {err && <Notice kind="error">{err}</Notice>}
    </>
  );
}
