"use client";
/**
 * "Who signs what" (PAP-23): the path draws itself as you scroll and each node lights up when
 * the line reaches it. Horizontal on desktop, vertical on mobile. Plain HTML (an ordered list),
 * so a screen reader reads the steps in order.
 */
import { useState } from "react";
import { useScrollProgress } from "./motion";

type Node = { who: string; does: string; icon: string };

const FLOWS: Record<"payments" | "secrets", { label: string; nodes: Node[] }> = {
  payments: {
    label: "Payments",
    nodes: [
      { icon: "🤖", who: "Agent", does: "signs the request" },
      { icon: "📨", who: "Relay", does: "carries it — holds no keys" },
      { icon: "📱", who: "Your phone", does: "Face ID · signs pay()" },
      { icon: "⛓️", who: "HSK Chain", does: "enforces limit + expiry" },
    ],
  },
  secrets: {
    label: "Secrets",
    nodes: [
      { icon: "💻", who: "Your laptop", does: "seals: your layer + the agent's" },
      { icon: "📨", who: "Relay", does: "stores ciphertext only" },
      { icon: "📱", who: "Your phone", does: "Face ID · removes your layer" },
      { icon: "⛓️", who: "HSK Chain", does: "counts the read (record)" },
      { icon: "🤖", who: "Agent", does: "opens the rest with its key" },
    ],
  },
};

export function HowItWorks() {
  const [flow, setFlow] = useState<keyof typeof FLOWS>("payments");
  const [ref, p] = useScrollProgress<HTMLDivElement>();
  const nodes = FLOWS[flow].nodes;
  const reached = Math.min(nodes.length - 1, Math.floor(p * 1.25 * (nodes.length - 1) + 0.001));
  const fill = Math.min(1, p * 1.25);

  return (
    <div ref={ref}>
      <div role="tablist" aria-label="Flow" className="mb-10 inline-flex rounded-full border border-border bg-surface p-1">
        {(Object.keys(FLOWS) as (keyof typeof FLOWS)[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={flow === k}
            onClick={() => setFlow(k)}
            className={`min-h-11 rounded-full px-5 font-cond text-[13px] font-semibold uppercase tracking-[0.18em] transition ${
              flow === k ? "bg-foreground text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {FLOWS[k].label}
          </button>
        ))}
      </div>

      <ol className="relative flex flex-col gap-10 md:flex-row md:justify-between md:gap-4">
        {/* track + fill: vertical on mobile, horizontal on desktop */}
        <span className="absolute left-[27px] top-4 bottom-4 w-px bg-border md:left-8 md:right-8 md:top-[27px] md:bottom-auto md:h-px md:w-auto" aria-hidden />
        <span
          className="absolute left-[27px] top-4 w-px origin-top bg-accent transition-transform duration-150 md:hidden"
          style={{ bottom: 16, transform: `scaleY(${fill})` }}
          aria-hidden
        />
        <span
          className="absolute left-8 right-8 top-[27px] hidden h-px origin-left bg-accent transition-transform duration-150 md:block"
          style={{ transform: `scaleX(${fill})` }}
          aria-hidden
        />
        {nodes.map((n, i) => {
          const lit = i <= reached;
          return (
            <li key={`${flow}-${n.who}-${i}`} className="relative flex items-start gap-5 md:flex-1 md:flex-col md:items-center md:text-center">
              <span
                className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-2xl transition-all duration-500 ${
                  lit ? "scale-100 border-accent bg-surface shadow-[0_0_0_6px_rgba(122,31,92,0.08)]" : "scale-90 border-border bg-background grayscale"
                }`}
              >
                {n.icon}
              </span>
              <div>
                <p className={`font-cond text-[15px] font-semibold uppercase tracking-[0.14em] transition-colors duration-500 ${lit ? "text-foreground" : "text-muted"}`}>{n.who}</p>
                <p className="mt-1 text-[15px] leading-snug text-muted md:max-w-[12rem]">{n.does}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
