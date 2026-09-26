"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fade-up on scroll (IntersectionObserver). */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export type TermLine = { c: string; t: string };

const GATE_LINES: TermLine[] = [
  { c: "$", t: "GET /api/gate/oracle" },
  { c: "<", t: "402 Payment Required · WWW-Authenticate: PAP-Visa" },
  { c: "·", t: "sign(challenge) with agent identity key" },
  { c: "$", t: "GET /api/gate/oracle  -H X-PAP-VISA: …" },
  { c: "·", t: "on-chain: getAgentWallet(#8) ✓  canAct(visa) ✓" },
  { c: "<", t: "200 OK  { price: HSK/USDT, value: 0.1133 }" },
];

/** Looping typewriter (defaults to the x402 handshake). */
export function Terminal({ lines = GATE_LINES }: { lines?: TermLine[] }) {
  const [shown, setShown] = useState<{ i: number; n: number }>({ i: 0, n: 0 });
  useEffect(() => {
    let alive = true;
    const step = () => {
      if (!alive) return;
      setShown((s) => {
        const line = lines[s.i];
        if (s.n < line.t.length) return { i: s.i, n: s.n + 1 };
        if (s.i < lines.length - 1) return { i: s.i + 1, n: 0 };
        return { i: -1, n: 0 }; // pause then restart
      });
    };
    const id = setInterval(() => {
      setShown((s) => {
        if (s.i === -1) return { i: 0, n: 0 };
        return s;
      });
      step();
    }, 28);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const done = shown.i === -1 ? lines.length : shown.i;
  return (
    <div className="rounded-2xl border border-border bg-[#1c1420] p-5 font-mono text-[13px] leading-6 text-[#e9e2f0] shadow-[0_30px_80px_-40px_rgba(122,31,92,0.6)]">
      <div className="mb-3 flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-bad/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-gold/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-ok/80" />
      </div>
      {lines.slice(0, done).map((l, i) => (
        <div key={i}>
          <span className={l.c === "<" ? "text-[#e58cbd]" : "text-muted"}>{l.c} </span>
          {l.t}
        </div>
      ))}
      {shown.i >= 0 && shown.i < lines.length && (
        <div className="cursor">
          <span className={lines[shown.i].c === "<" ? "text-[#e58cbd]" : "text-muted"}>{lines[shown.i].c} </span>
          {lines[shown.i].t.slice(0, shown.n)}
        </div>
      )}
    </div>
  );
}

/** Agent → Phone → Chain with a dot travelling the path, forever. */
export function Flow() {
  const nodes = [
    { x: 60, y: 90, label: "Agent", sub: "Claude Code · MCP" },
    { x: 300, y: 40, label: "Relay", sub: "signed request" },
    { x: 540, y: 90, label: "Phone", sub: "passkey · Face ID" },
    { x: 780, y: 40, label: "HSK Chain", sub: "AgentPassport.pay" },
  ];
  const d = "M60,90 C180,90 180,40 300,40 S420,90 540,90 S660,40 780,40";
  return (
    <svg viewBox="0 0 840 140" className="w-full" aria-hidden>
      <path d={d} fill="none" stroke="var(--border)" strokeWidth="2" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" className="march" opacity="0.6" />
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="10" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
          <text x={n.x} y={n.y + 34} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--foreground)" fontFamily="var(--font-barlow)" letterSpacing="0.5">
            {n.label.toUpperCase()}
          </text>
          <text x={n.x} y={n.y + 52} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {n.sub}
          </text>
        </g>
      ))}
      <circle r="6" fill="var(--accent-soft)" style={{ offsetPath: `path("${d}")`, animation: "travel 4s linear infinite" }}>
        <animate attributeName="r" values="5;7;5" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/** True once (or while, with `once: false`) the element is in the viewport. */
export function useInView<T extends Element>(opts: { once?: boolean; rootMargin?: string; threshold?: number } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { once = true, rootMargin = "0px", threshold = 0.2 } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting && once) io.disconnect();
      },
      { rootMargin, threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin, threshold]);
  return [ref, inView] as const;
}

/** 0 → 1 as the element travels through the viewport (top enters bottom → bottom leaves middle). */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (still) return setP(1);
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh * 0.4;
      setP(Math.min(1, Math.max(0, (vh * 0.8 - r.top) / total)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return [ref, p] as const;
}

/** Copy-to-clipboard button (works on iOS; falls back to selecting the text). */
export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className={`min-h-11 min-w-11 rounded-full border border-white/15 px-3 font-cond text-[12px] font-semibold uppercase tracking-[0.18em] text-[#e9e2f0] hover:bg-white/10 ${className}`}
      aria-label="Copy command"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
