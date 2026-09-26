"use client";
/**
 * The scroll story (PAP-22): five steps, one sentence each. On desktop a phone stays pinned and
 * changes screen as each step reaches the middle of the viewport; on mobile every step carries
 * its own small phone so nothing depends on sticky positioning.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

type Step = { key: string; kicker: string; title: string; line: string; screen: (on: boolean) => ReactNode };

export const STEPS: Step[] = [
  {
    key: "passport",
    kicker: "Passport",
    title: "Your agent gets an identity, not a key.",
    line: "Registered on HSK Chain as ERC-8004. You own it.",
    screen: () => <PairScreen />,
  },
  {
    key: "visa",
    kicker: "Visa",
    title: "You decide how much, and until when.",
    line: "Scope, limit and expiry live in the contract.",
    screen: (on) => <VisaScreen on={on} />,
  },
  {
    key: "faceid",
    kicker: "Face ID",
    title: "Anything sensitive goes through your phone.",
    line: "The agent asks. You read it. Face ID.",
    screen: (on) => <ApproveScreen on={on} />,
  },
  {
    key: "secrets",
    kicker: "Secrets",
    title: "Your API keys, sealed with two signatures.",
    line: "Its signature plus your Face ID. The server only sees ciphertext.",
    screen: (on) => <SecretScreen on={on} />,
  },
  {
    key: "chain",
    kicker: "On-chain",
    title: "The contract says no. Not the app.",
    line: "Over the limit, it reverts. Every action is stamped.",
    screen: (on) => <ChainScreen on={on} />,
  },
];

export function Story() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1fr_380px] md:gap-16">
      <ol className="flex flex-col">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            className="flex min-h-[70svh] flex-col justify-center py-10 md:min-h-[80vh]"
          >
            <p className={`font-cond text-[12px] font-semibold uppercase tracking-[0.22em] transition-colors ${active === i ? "text-accent" : "text-muted"}`}>
              {String(i + 1).padStart(2, "0")} — {s.kicker}
            </p>
            <h3
              className={`mt-3 max-w-xl font-serif text-[40px] font-medium leading-[1.02] tracking-tight transition-all duration-500 md:text-6xl ${
                active === i ? "text-foreground" : "text-foreground/60"
              }`}
            >
              {s.title}
            </h3>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted">{s.line}</p>
            <div className="mt-8 md:hidden">
              <Phone small>{s.screen(active === i)}</Phone>
            </div>
          </li>
        ))}
      </ol>
      <div className="hidden md:block">
        <div className="sticky top-[12vh]">
          <Phone>
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`absolute inset-0 transition-all duration-500 ${active === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
                aria-hidden={active !== i}
              >
                {s.screen(active === i)}
              </div>
            ))}
          </Phone>
          <div className="mt-6 flex justify-center gap-2" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.key} className={`h-1.5 rounded-full transition-all ${active === i ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────── phone + screens ─────────────

export function Phone({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-[2.6rem] border-[10px] border-[#1c1420] bg-background shadow-[0_40px_90px_-40px_rgba(122,31,92,0.55)] ${
        small ? "h-[420px] w-[250px]" : "h-[680px] w-[340px]"
      }`}
    >
      <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1c1420]" aria-hidden />
      <div className={`relative h-full w-full ${small ? "text-[12px]" : "text-[14px]"}`}>{children}</div>
    </div>
  );
}

const Card = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-border bg-surface p-4 shadow-[0_8px_24px_-18px_rgba(28,20,32,0.35)]">{children}</div>
);
const Screen = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex h-full flex-col gap-3 px-4 pb-6 pt-10">
    <p className="font-cond text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{title}</p>
    {children}
  </div>
);
const Btn = ({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "ghost" }) => (
  <div className={`rounded-full py-3 text-center font-semibold ${tone === "dark" ? "bg-foreground text-white" : "text-bad"}`}>{children}</div>
);

/** Deterministic QR-looking grid (decorative). */
function FakeQR() {
  const cells: ReactNode[] = [];
  let x = 7;
  for (let r = 0; r < 21; r++)
    for (let c = 0; c < 21; c++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      const finder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
      const on = finder ? r % 6 === 0 || c % 6 === 0 || (r % 7 > 1 && r % 7 < 5 && c % 7 > 1 && c % 7 < 5) || c === 20 || r === 20 : x % 3 === 0;
      if (on) cells.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />);
    }
  return (
    <svg viewBox="0 0 21 21" className="mx-auto w-3/5 fill-foreground" aria-hidden>
      {cells}
    </svg>
  );
}

function PairScreen() {
  return (
    <Screen title="Connect agent">
      <Card>
        <FakeQR />
        <p className="mt-3 text-center font-semibold">Claude Code @ laptop</p>
        <p className="text-center text-muted">wants to connect</p>
      </Card>
      <Card>
        <div className="flex justify-between">
          <span className="text-muted">ERC-8004</span>
          <span className="font-mono">agent #8</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Owner</span>
          <span className="font-mono">you</span>
        </div>
      </Card>
      <div className="mt-auto">
        <Btn>Connect with Face ID</Btn>
      </div>
    </Screen>
  );
}

function VisaScreen({ on }: { on: boolean }) {
  return (
    <Screen title="Visa">
      <Card>
        <p className="font-semibold">Claude Code @ laptop</p>
        <p className="mt-3 font-serif text-4xl">
          100 <span className="text-lg text-muted">demoUSDT</span>
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-accent transition-all duration-[1400ms] ease-out" style={{ width: on ? "35%" : "0%" }} />
        </div>
        <div className="mt-2 flex justify-between text-muted">
          <span>35 used</span>
          <span>7 days</span>
        </div>
      </Card>
      <Card>
        <p className="font-semibold">🔑 openai</p>
        <p className="text-muted">3 of 10 reads · until Oct 3</p>
      </Card>
      <p className="mt-auto text-center text-muted">Enforced by AgentPassport on HSK Chain</p>
    </Screen>
  );
}

function Stamp({ on, children, tone = "accent" }: { on: boolean; children: ReactNode; tone?: "accent" | "ok" | "bad" }) {
  const c = tone === "ok" ? "border-ok text-ok" : tone === "bad" ? "border-bad text-bad" : "border-accent text-accent";
  return (
    <span
      className={`absolute -top-3 right-3 z-10 rounded-md border-2 bg-surface px-2 py-0.5 font-cond text-[11px] font-semibold uppercase tracking-[0.2em] ${c} ${on ? "stamp-in" : "opacity-0 motion-reduce:opacity-100"}`}
    >
      {children}
    </span>
  );
}

function ApproveScreen({ on }: { on: boolean }) {
  return (
    <Screen title="Approve action">
      <div className="relative">
        <Card>
          <Stamp on={on}>Approved</Stamp>
          <p className="font-semibold">Claude Code @ laptop</p>
          <p className="text-muted">wants to</p>
          <p className="mt-1 font-serif text-3xl leading-tight">💸 Send 10 demoUSDT</p>
          <div className="mt-3 flex justify-between border-t border-border pt-2">
            <span className="text-muted">To</span>
            <span>María</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted">Memo</span>
            <span>dataset</span>
          </div>
        </Card>
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <Btn>Approve with Face ID</Btn>
        <Btn tone="ghost">Reject</Btn>
      </div>
    </Screen>
  );
}

function SecretScreen({ on }: { on: boolean }) {
  return (
    <Screen title="Approve action">
      <div className="relative">
        <Card>
          <Stamp on={on} tone="ok">
            Released
          </Stamp>
          <p className="font-semibold">Claude Code @ laptop</p>
          <p className="text-muted">wants to</p>
          <p className="mt-1 font-serif text-3xl leading-tight">🔑 Read “openai”</p>
          <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
            <p className="font-cond text-[10px] uppercase tracking-[0.2em] text-muted">Reason given by the agent</p>
            <p className="mt-1">“Run the integration tests”</p>
          </div>
          <p className="mt-3 text-muted">Unlocks your layer only.</p>
        </Card>
      </div>
      <div className="mt-auto">
        <Btn>Face ID to allow</Btn>
      </div>
    </Screen>
  );
}

function ChainScreen({ on }: { on: boolean }) {
  const rows: [string, string, "ok" | "bad"][] = [
    ["💸 10 demoUSDT → María", "0xe152…", "ok"],
    ["🔑 read “openai”", "0x7a41…", "ok"],
    ["💸 25 demoUSDT → API", "0x629d…", "ok"],
    ["💸 500 demoUSDT", "LimitExceeded()", "bad"],
  ];
  return (
    <Screen title="Passport stamps">
      <Card>
        <ul className="divide-y divide-border">
          {rows.map(([t, h, tone], i) => (
            <li
              key={t}
              className={`flex items-center justify-between gap-2 py-2 transition-all duration-500 ${on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"}`}
              style={{ transitionDelay: on ? `${i * 220}ms` : "0ms" }}
            >
              <span>{t}</span>
              <span className={`font-mono text-[11px] ${tone === "bad" ? "text-bad" : "text-accent"}`}>{h}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-auto text-center text-muted">Read from HSK Chain</p>
    </Screen>
  );
}
