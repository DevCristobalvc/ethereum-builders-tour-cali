"use client";
/** "Install it in your agent" (PAP-24) and "Hand over a key" (PAP-25), plus the adaptive hero CTA and the marquee (PAP-26/27). */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton, Terminal, useInView, type TermLine } from "./motion";

const REPO = "https://github.com/DevCristobalvc/ethereum-builders-tour-cali";
const CLONE = "git clone https://github.com/DevCristobalvc/ethereum-builders-tour-cali && cd ethereum-builders-tour-cali";

type Tab = { id: string; label: string; blocks: { note: string; code: string }[]; after: string };

const TABS: Tab[] = [
  {
    id: "claude",
    label: "Claude Code",
    blocks: [
      { note: "Add the marketplace", code: "/plugin marketplace add DevCristobalvc/ethereum-builders-tour-cali" },
      { note: "Install the plugin (MCP server + skills)", code: "/plugin install pap@pap" },
    ],
    after: "Then ask: “connect to PAP” — a QR appears, scan it with your phone.",
  },
  {
    id: "mcp",
    label: "Cursor · Desktop",
    blocks: [
      { note: "Get the server (one bundled file)", code: CLONE },
      {
        note: "Add it to your MCP config",
        code: `{ "mcpServers": { "pap": { "command": "node", "args": ["<repo>/mcp/dist/pap.mjs"], "env": { "PAP_RELAY_URL": "https://pap.devcristobalvc.com" } } } }`,
      },
    ],
    after: "Restart the client and call pap_connect.",
  },
  {
    id: "any",
    label: "Any agent",
    blocks: [
      { note: "Local Ethereum signer — cast, viem, ethers, web3.py", code: "node mcp/dist/pap-cli.mjs rpc --port 8545" },
      { note: "…or plain JSON-RPC from any language", code: "curl https://pap.devcristobalvc.com/api/rpc -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"rpc.discover\"}'" },
    ],
    after: "No private key in .env: transactions and secrets go through your phone.",
  },
  {
    id: "cli",
    label: "CLI",
    blocks: [
      { note: "Run a command with a sealed key in its env only", code: 'node mcp/dist/pap-cli.mjs secret exec openai --reason "Run the tests" -- npm test' },
    ],
    after: "Exit code 4 if you reject on the phone.",
  },
];

const PAIR_LINES: TermLine[] = [
  { c: "›", t: "connect to PAP" },
  { c: "·", t: "pap_connect → QR on screen" },
  { c: "<", t: "Paired · ERC-8004 agent #8 · visa 100 demoUSDT / 7d" },
  { c: "›", t: "run the tests that need the OpenAI key" },
  { c: "·", t: "pap_secret(openai) → waiting for your phone…" },
  { c: "<", t: "APPROVED · written to ~/.pap/secrets/openai (0600)" },
];

export function Install() {
  const [tab, setTab] = useState(TABS[0].id);
  const t = TABS.find((x) => x.id === tab)!;
  return (
    <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-start">
      <div>
        <div role="tablist" aria-label="Agent" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`min-h-11 shrink-0 rounded-full border px-4 font-cond text-[13px] font-semibold uppercase tracking-[0.16em] transition ${
                tab === x.id ? "border-foreground bg-foreground text-white" : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-4">
          {t.blocks.map((b) => (
            <div key={b.code}>
              <p className="mb-2 text-sm text-muted">{b.note}</p>
              <div className="flex items-start gap-3 rounded-2xl bg-[#1c1420] p-4">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px] leading-6 text-[#e9e2f0]">{b.code}</code>
                <CopyButton text={b.code} />
              </div>
            </div>
          ))}
          <p className="text-[15px] text-foreground/80">{t.after}</p>
        </div>
        <ol className="mt-8 grid grid-cols-3 gap-3 text-center">
          {["Install", "Scan the QR", "Done"].map((s, i) => (
            <li key={s} className="rounded-2xl border border-border bg-surface px-2 py-4">
              <p className="font-cond text-[11px] uppercase tracking-[0.2em] text-accent">0{i + 1}</p>
              <p className="mt-1 font-serif text-xl">{s}</p>
            </li>
          ))}
        </ol>
      </div>
      <Terminal lines={PAIR_LINES} />
    </div>
  );
}

const CRED_STEPS = [
  { title: "Paste it on your laptop", body: "pap seal openai — hidden prompt, never in a chat.", icon: "⌨️" },
  { title: "Pick the agent and the limits", body: "Max reads and days. Approve once on your phone.", icon: "📱" },
  { title: "Sealed", body: "It opens only with the agent’s signature + your Face ID.", icon: "🔒" },
];

export function Credentials() {
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, threshold: 0.35 });
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setStep((s) => (s + 1) % CRED_STEPS.length), 1800);
    return () => clearInterval(t);
  }, [inView]);
  return (
    <div ref={ref} className="grid gap-10 md:grid-cols-2 md:items-center">
      <ol className="flex flex-col gap-3">
        {CRED_STEPS.map((s, i) => (
          <li
            key={s.title}
            className={`flex items-start gap-4 rounded-2xl border p-5 transition-all duration-500 ${
              step === i ? "border-accent bg-surface shadow-[0_20px_50px_-30px_rgba(122,31,92,0.5)]" : "border-border bg-surface/50"
            }`}
          >
            <span className="text-2xl" aria-hidden>
              {s.icon}
            </span>
            <div>
              <p className="font-serif text-2xl leading-tight">{s.title}</p>
              <p className="mt-1 text-[15px] text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-[#1c1420] p-5 font-mono text-[13px] leading-7 text-[#e9e2f0]">
          <div className="text-[#a89bab]">$ node mcp/dist/pap-cli.mjs seal openai --max-reads 10 --days 7</div>
          <div>Secret value (hidden, Enter to finish): ••••••••••••</div>
          <div className="text-[#e58cbd]">🔒 Sealed “openai” for Claude Code: only opens with its signature + yours.</div>
          <div className="text-[#a89bab]">Approve on your phone to activate it (10 reads, 7 days)</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/vault/new" className="btn-sweep inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-deep">
            Or seal it from your phone →
          </Link>
        </div>
        <p className="text-sm text-muted">
          Once released, the agent has the value — so seal short-lived, limited keys.{" "}
          <a className="text-accent underline underline-offset-2" href={`${REPO}/blob/main/docs/SECURITY.md#sealed-secrets--threat-model`} target="_blank" rel="noreferrer">
            What it protects, and what it doesn’t →
          </a>
        </p>
      </div>
    </div>
  );
}

/** Phone visitors get "Open my passport"; desktop visitors get "Install in your agent" first. */
export function HeroCTA() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse) and (max-width: 820px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const primary = "btn-sweep inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-deep";
  const secondary =
    "inline-flex min-h-12 items-center justify-center rounded-full border border-foreground/30 bg-surface/60 px-6 text-[15px] font-semibold text-foreground backdrop-blur hover:bg-surface";
  const open = (
    <Link key="open" href="/wallet" className={phone ? primary : secondary}>
      Open my passport
    </Link>
  );
  const install = (
    <a key="install" href="#install" className={phone ? secondary : primary}>
      Install in your agent
    </a>
  );
  return <div className="flex flex-wrap gap-3">{phone ? [open, install] : [install, open]}</div>;
}

const ROW_A = ["Claude Code", "Cursor", "Claude Desktop", "MCP", "Agent Skills", "JSON-RPC 2.0", "EIP-1193", "EIP-712"];
const ROW_B = ["cast", "viem", "ethers", "web3.py", "ERC-8004", "x402-style gate", "Web Push", "HSK Chain"];

/** Two infinite rows in opposite directions; hover (or tap) pauses them. */
export function Marquee() {
  const [paused, setPaused] = useState(false);
  const row = (items: string[], reverse: boolean) => (
    <div className="overflow-hidden">
      <div className={`marquee flex w-max whitespace-nowrap ${reverse ? "marquee-rev" : ""}`}>
        {[0, 1].map((k) => (
          <span key={k} className="flex" aria-hidden={k === 1}>
            {items.map((t) => (
              <span key={t} className="flex items-center px-6">
                {t} <span className="ml-12 text-accent">✦</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div
      className={`marquee-wrap flex flex-col gap-2 border-y border-border bg-paper-deep/60 py-3 font-cond text-[13px] font-semibold uppercase tracking-[0.22em] text-muted ${paused ? "paused" : ""}`}
      onClick={() => setPaused((p) => !p)}
      aria-label="Works with"
    >
      {row(ROW_A, false)}
      {row(ROW_B, true)}
    </div>
  );
}
