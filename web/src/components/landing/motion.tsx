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

/** Looping typewriter for the x402 handshake. */
export function Terminal() {
  const lines = [
    { c: "$", t: "GET /api/gate/oracle" },
    { c: "<", t: "402 Payment Required · WWW-Authenticate: PAP-Visa" },
    { c: "·", t: "sign(challenge) with agent identity key" },
    { c: "$", t: "GET /api/gate/oracle  -H X-PAP-VISA: …" },
    { c: "·", t: "on-chain: getAgentWallet(#8) ✓  canAct(visa) ✓" },
    { c: "<", t: "200 OK  { price: HSK/USDT, value: 0.1133 }" },
  ];
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
          <span className={l.c === "<" ? "text-accent-soft" : "text-muted"}>{l.c} </span>
          {l.t}
        </div>
      ))}
      {shown.i >= 0 && shown.i < lines.length && (
        <div className="cursor">
          <span className={lines[shown.i].c === "<" ? "text-accent-soft" : "text-muted"}>{lines[shown.i].c} </span>
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
