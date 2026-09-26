"use client";
/** Big QR for the laptop screen. Polls the relay and flips to a success state when the phone resolves it. */
import QRCode from "qrcode";
import { use, useEffect, useState } from "react";
import { Logo, Status, TxLink } from "@/components/ui";
import { summarize } from "@/lib/actions";
import { TOKEN_SYMBOL } from "@/lib/chain";
import type { PairState, RequestState } from "@/lib/types";

export default function ShowPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = use(params);
  const isPair = kind === "pair";
  const target = `${typeof location !== "undefined" ? location.origin : ""}/${isPair ? "pair" : "approve"}/${id}`;
  const [svg, setSvg] = useState<string>("");
  const [state, setState] = useState<PairState | RequestState>();

  useEffect(() => {
    QRCode.toString(target, { type: "svg", margin: 1, color: { dark: "#18182c", light: "#ffffff" } }).then(setSvg);
  }, [target]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/${isPair ? "pair" : "requests"}/${id}`, { cache: "no-store" });
        if (r.ok && alive) setState(await r.json());
      } catch {}
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, isPair]);

  const resolved = state && state.status !== "pending";
  const req = !isPair ? (state as RequestState | undefined) : undefined;
  const pair = isPair ? (state as PairState | undefined) : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex items-center gap-3">
        <Logo size={32} />
        <h1 className="text-2xl font-semibold tracking-tight">Passport Agent Protocol</h1>
      </div>

      {!resolved ? (
        <>
          <p className="max-w-md text-lg text-muted">
            {isPair ? (
              <>
                <b className="text-foreground">{pair?.agentName ?? "Your agent"}</b> wants to connect. Scan with your phone
                and approve with Face ID.
              </>
            ) : (
              <>
                <b className="text-foreground">{req?.agentName ?? "Your agent"}</b> wants to{" "}
                <b className="text-foreground">{req ? summarize(req.action).title.toLowerCase() : "act"}</b>. Scan to review and
                approve.
              </>
            )}
          </p>
          <div
            className="w-[min(70vw,420px)] rounded-3xl border border-border bg-white p-5 shadow-[0_20px_60px_-30px_rgba(0,153,255,0.5)]"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="font-mono text-sm text-muted">{target}</p>
          <p className="animate-pulse text-sm text-accent">Waiting for your phone…</p>
        </>
      ) : (
        <>
          <div className="text-7xl">{state.status === "approved" ? "✅" : "⛔"}</div>
          <p className="text-2xl font-semibold">
            {isPair
              ? state.status === "approved"
                ? `Agent connected · ERC-8004 #${pair?.agentId}`
                : "Pairing rejected"
              : state.status === "approved"
                ? req?.action.type === "transfer"
                  ? `Sent ${req.action.amount} ${TOKEN_SYMBOL}`
                  : `Approved: ${req ? summarize(req.action).title : ""}`
                : `Request ${state.status}`}
          </p>
          <Status s={state.status} />
          {state.txHash && (
            <p className="text-lg">
              HSK Chain tx: <TxLink hash={state.txHash} />
            </p>
          )}
          <p className="text-muted">The agent has been notified and is continuing its work.</p>
        </>
      )}
    </main>
  );
}
