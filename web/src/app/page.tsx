import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HowItWorks } from "@/components/landing/how";
import { Credentials, HeroCTA, Install, Marquee } from "@/components/landing/install";
import { LiveStats } from "@/components/landing/LiveStats";
import { Reveal, Terminal } from "@/components/landing/motion";
import { Story } from "@/components/landing/story";
import { Logo } from "@/components/ui";
import { ADDRESSES, EXPLORER, addrUrl } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Passport Agent Protocol",
  description:
    "Your agent has a passport. You stamp the visas. Payments and API keys for AI agents, approved from your phone, enforced on HSK Chain.",
};

const REPO = "https://github.com/DevCristobalvc/ethereum-builders-tour-cali";
const CONTRACTS: { name: string; key: keyof typeof ADDRESSES; role: string }[] = [
  { name: "AgentPassport", key: "AgentPassport", role: "visas, pay(), secret reads" },
  { name: "IdentityRegistry", key: "IdentityRegistry", role: "ERC-8004, agent to human" },
  { name: "DemoUSDT", key: "DemoUSDT", role: "test stablecoin" },
  { name: "ReputationRegistry", key: "ReputationRegistry", role: "ERC-8004 feedback" },
  { name: "PassportRegistry", key: "PassportRegistry", role: "ZK membership (roadmap)" },
  { name: "Groth16Verifier", key: "Groth16Verifier", role: "ZK verifier (roadmap)" },
];

const DEMO_VIDEO = "https://youtu.be/MEXjbFrVGXo";
const REFERENCES: [string, string][] = [
  ["Architecture", "docs/ARCHITECTURE.md"],
  ["JSON-RPC interface", "docs/RPC.md"],
  ["Guide for agents", "docs/AGENTS.md"],
  ["Security and threat model", "docs/SECURITY.md"],
  ["Service gate", "docs/GATE.md"],
];

const h2 = "font-serif text-[34px] font-semibold leading-[1.1] tracking-tight text-foreground md:text-[44px]";
const lead = "mt-4 max-w-2xl text-[18px] leading-relaxed text-muted";

/** Numbered section heading, as in a paper: "3  Protocol". */
function Heading({ n, label, title, children }: { n: number; label: string; title: string; children?: ReactNode }) {
  return (
    <Reveal>
      <p className="eyebrow">
        {n}&nbsp;&nbsp;{label}
      </p>
      <h2 className={`${h2} mt-3 max-w-3xl`}>{title}</h2>
      {children}
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-5">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">
              PAP<span className="hidden font-normal text-muted sm:inline"> · Passport Agent Protocol</span>
            </span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#story" className="hover:text-foreground">Design</a>
            <a href="#how" className="hover:text-foreground">Protocol</a>
            <a href="#install" className="hover:text-foreground">Integration</a>
            <a href="#keys" className="hover:text-foreground">Credentials</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
          <Link href="/wallet" className="inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-[14px] font-medium text-white hover:bg-accent-deep">
            Open wallet
          </Link>
        </nav>
      </header>

      {/* title block */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-28 md:grid-cols-[1.25fr_1fr] md:items-end md:px-5 md:pb-24 md:pt-40">
        <div>
          <p className="eyebrow text-muted">White paper · v1.0 · HSK Chain testnet</p>
          <h1 className="mt-5 font-serif text-[44px] font-semibold leading-[1.04] tracking-tight text-foreground md:text-[68px]">
            Your agent has a passport.
            <br />
            <span className="font-normal italic text-accent">You stamp the visas.</span>
          </h1>
          <p className="mt-6 text-[15px] text-muted">Passport Agent Protocol · Ethereum Builders Tour, Cali · 2026</p>
          <div className="mt-8 border-l-2 border-accent pl-5">
            <p className="eyebrow text-muted">Abstract</p>
            <p className="mt-2 max-w-xl font-serif text-[18px] leading-relaxed text-foreground/90">
              AI agents need to pay and to use credentials, but a private key in an environment file is unlimited, permanent authority. PAP gives
              each agent an on-chain identity (ERC-8004) and scoped, expiring visas. Payments and secret reads are approved from the owner&apos;s
              phone with a passkey and enforced by a contract, not by the app.
            </p>
          </div>
          <div className="mt-8">
            <HeroCTA />
          </div>
          <p className="mt-5 text-[15px]">
            <a href="https://youtu.be/MEXjbFrVGXo" target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
              Watch the 3-minute demo
            </a>
            <span className="text-muted"> · a real agent on HashKey Chain testnet</span>
          </p>
        </div>
        <figure>
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm border border-border bg-paper-deep">
            <Image
              src="/fondo-sm.jpg"
              alt="Detail after Michelangelo's Creation of Adam: a robotic hand reaching toward a human hand."
              fill
              priority
              sizes="(min-width: 768px) 40vw, 100vw"
              quality={70}
              className="object-cover object-center grayscale"
            />
          </div>
          <figcaption className="mt-3 text-[13px] leading-snug text-muted">
            <span className="font-semibold text-foreground">Figure 1.</span> The agent reaches out; the human grants the reach.
          </figcaption>
        </figure>
      </section>

      {/* compatibility */}
      <Marquee />

      {/* 1 · problem */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-5 md:py-28">
        <Heading n={1} label="Problem" title="A key in .env is a blank check.">
          <p className="mt-6 font-mono text-[15px] text-muted">
            <span className="strike">PRIVATE_KEY=0x4c0883a6…</span>
          </p>
          <p className={lead}>Full access, forever, one prompt injection away.</p>
        </Heading>
      </section>

      {/* 2 · design */}
      <section id="story" className="border-t border-border bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-4 pt-20 md:px-5 md:pt-28">
          <Heading n={2} label="Design" title="Five properties, one per screen." />
        </div>
        <Story />
      </section>

      {/* 3 · protocol */}
      <section id="how" className="border-y border-border py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-5">
          <Heading n={3} label="Protocol" title="Who signs what." />
          <div className="mt-12">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* 4 · integration */}
      <section id="install" className="mx-auto max-w-6xl px-4 py-20 md:px-5 md:py-28">
        <Heading n={4} label="Integration" title="Install it in your agent.">
          <p className={lead}>One command for Claude Code; a single bundled file for any other MCP client or language.</p>
        </Heading>
        <div className="mt-12">
          <Install />
        </div>
      </section>

      {/* 5 · credentials */}
      <section id="keys" className="border-y border-border bg-paper-deep/50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-5">
          <Heading n={5} label="Sealed credentials" title="Hand over a key without handing it over." />
          <div className="mt-12">
            <Credentials />
          </div>
        </div>
      </section>

      {/* 6 · services */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-5 md:py-28">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Heading n={6} label="Service verification" title="Services check the visa, not you.">
            <p className={lead}>An x402-style 402, a signed challenge, one on-chain check. No human prompt.</p>
          </Heading>
          <Reveal delay={150}>
            <Terminal />
          </Reveal>
        </div>
      </section>

      {/* 7 · deployment */}
      <section id="chain" className="border-t border-border bg-paper-deep/50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-5">
          <Heading n={7} label="Deployment" title="Live on HSK Chain." />
          <Reveal className="mt-12">
            <LiveStats />
          </Reveal>
          <div className="mt-8 overflow-hidden rounded-sm border border-border bg-surface">
            <p className="border-b border-border px-5 py-3 text-[13px] text-muted">
              <span className="font-semibold text-foreground">Table 1.</span> Verified contracts on HSK Chain testnet (chainId 133).
            </p>
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[12px] text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Contract</th>
                  <th scope="col" className="hidden px-5 py-2 font-medium md:table-cell">Role</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CONTRACTS.map((c) => {
                  const a = ADDRESSES[c.key];
                  return (
                    <tr key={c.name}>
                      <td className="px-5 py-3 font-semibold">{c.name}</td>
                      <td className="hidden px-5 py-3 text-muted md:table-cell">{c.role}</td>
                      <td className="px-5 py-3 text-right font-mono text-[13px]">
                        {a ? (
                          <a className="text-accent hover:underline" href={addrUrl(a)} target="_blank" rel="noreferrer">
                            {a.slice(0, 8)}…{a.slice(-6)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-border px-5 py-3 text-[12px] text-muted">
              Explorer:{" "}
              <a className="text-accent hover:underline" href={EXPLORER} target="_blank" rel="noreferrer">
                testnet-explorer.hskchain.net
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* references + footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-5">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h2 className={h2}>Try it on your phone.</h2>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/wallet" className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-deep">
                  Open my passport
                </Link>
                <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-md border border-foreground/25 px-6 text-[15px] font-medium text-foreground hover:bg-surface">
                  Source on GitHub
                </a>
                <a href={DEMO_VIDEO} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-md border border-foreground/25 px-6 text-[15px] font-medium text-foreground hover:bg-surface">
                  Watch the demo
                </a>
              </div>
            </div>
            <div>
              <p className="eyebrow">References</p>
              <ol className="mt-4 flex flex-col gap-2 text-[15px]">
                {REFERENCES.map(([t, p], i) => (
                  <li key={p} className="flex gap-3">
                    <span className="font-mono text-[13px] leading-6 text-muted">[{i + 1}]</span>
                    <a className="text-foreground underline decoration-border underline-offset-4 hover:text-accent hover:decoration-accent" href={`${REPO}/blob/main/${p}`} target="_blank" rel="noreferrer">
                      {t}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="rule mt-16" />
          <p className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
            <span>Passport Agent Protocol · Ethereum Builders Tour Cali · 2026</span>
            <span>@DevCristobalvc</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
