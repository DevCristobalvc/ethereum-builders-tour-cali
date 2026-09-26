import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
  { name: "AgentPassport", key: "AgentPassport", role: "visas · pay() · secret reads" },
  { name: "IdentityRegistry", key: "IdentityRegistry", role: "ERC-8004 · agent ↔ human" },
  { name: "DemoUSDT", key: "DemoUSDT", role: "test stablecoin" },
  { name: "ReputationRegistry", key: "ReputationRegistry", role: "ERC-8004 feedback" },
  { name: "PassportRegistry", key: "PassportRegistry", role: "ZK membership (roadmap)" },
  { name: "Groth16Verifier", key: "Groth16Verifier", role: "ZK verifier (roadmap)" },
];

const eyebrow = "font-cond text-[12px] font-semibold uppercase tracking-[0.22em] text-accent";
const h2 = "font-serif text-[40px] font-medium leading-[1.02] tracking-tight text-foreground md:text-6xl";

export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-5">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Logo />
            <span className="font-cond text-[15px] font-semibold uppercase tracking-[0.16em]">
              PAP<span className="hidden sm:inline"> · Passport Agent Protocol</span>
            </span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#story" className="hover:text-foreground">Story</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#install" className="hover:text-foreground">Install</a>
            <a href="#keys" className="hover:text-foreground">API keys</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
          <Link href="/wallet" className="btn-sweep inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-deep">
            Open wallet
          </Link>
        </nav>
      </header>

      {/* 0 · hero */}
      <section className="grain relative flex min-h-[100svh] items-end overflow-hidden">
        <Image src="/fondo.jpg" alt="" fill priority sizes="100vw" quality={70} className="object-cover object-center" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" aria-hidden />
        <div className="pointer-events-none absolute left-[49.6%] top-[50.2%] z-10" aria-hidden>
          <span className="ripple absolute h-16 w-16 rounded-full border border-accent-soft/60" />
          <span className="ripple d2 absolute h-16 w-16 rounded-full border border-accent-soft/60" />
          <span className="ripple d3 absolute h-16 w-16 rounded-full border border-accent-soft/60" />
          <span className="spark absolute h-5 w-5 rounded-full bg-[#fff2c8] shadow-[0_0_40px_14px_rgba(255,220,150,0.8),0_0_90px_40px_rgba(192,74,138,0.35)]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-14 pt-32 md:px-5 md:pb-24">
          <h1 className="max-w-4xl font-serif text-[14vw] font-medium leading-[0.92] tracking-tight text-foreground md:text-[104px]">
            Your agent has a passport.
            <br />
            <em className="text-accent">You stamp the visas.</em>
          </h1>
          <p className="rise-2 mt-6 max-w-md text-lg leading-relaxed text-foreground/80">
            Payments and API keys, approved from your phone. Enforced on-chain.
          </p>
          <div className="rise-3 mt-8">
            <HeroCTA />
          </div>
        </div>
      </section>

      {/* 1 · marquee */}
      <Marquee />

      {/* 2 · problem */}
      <section className="mx-auto max-w-6xl px-4 py-24 md:px-5 md:py-36">
        <Reveal>
          <p className="font-mono text-[15px] text-muted md:text-lg">
            <span className="strike">PRIVATE_KEY=0x4c0883a6…</span>
          </p>
          <h2 className={`${h2} mt-6 max-w-3xl`}>A key in .env is a blank check.</h2>
          <p className="mt-4 max-w-md text-[17px] text-muted">Full access, forever, one prompt injection away.</p>
        </Reveal>
      </section>

      {/* 3–7 · story */}
      <section id="story" className="border-t border-border bg-paper-deep/30">
        <Story />
      </section>

      {/* 8 · how it works */}
      <section id="how" className="border-y border-border py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4 md:px-5">
          <Reveal>
            <p className={eyebrow}>How it works</p>
            <h2 className={`${h2} mt-4`}>Who signs what.</h2>
          </Reveal>
          <div className="mt-12">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* 9 · install */}
      <section id="install" className="mx-auto max-w-6xl px-4 py-24 md:px-5 md:py-32">
        <Reveal>
          <p className={eyebrow}>Install</p>
          <h2 className={`${h2} mt-4`}>Install it in your agent.</h2>
          <p className="mt-4 text-[17px] text-muted">One command.</p>
        </Reveal>
        <div className="mt-12">
          <Install />
        </div>
      </section>

      {/* 10 · credentials */}
      <section id="keys" className="border-y border-border bg-paper-deep/30 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4 md:px-5">
          <Reveal>
            <p className={eyebrow}>API keys</p>
            <h2 className={`${h2} mt-4 max-w-3xl`}>Hand over a key without handing it over.</h2>
          </Reveal>
          <div className="mt-12">
            <Credentials />
          </div>
        </div>
      </section>

      {/* services / gate */}
      <section className="mx-auto max-w-6xl px-4 py-24 md:px-5 md:py-32">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className={eyebrow}>Services</p>
            <h2 className={`${h2} mt-4`}>Services check the visa, not you.</h2>
            <p className="mt-4 max-w-md text-[17px] text-muted">An x402-style 402, a signed challenge, one on-chain check. No human prompt.</p>
          </Reveal>
          <Reveal delay={150}>
            <Terminal />
          </Reveal>
        </div>
      </section>

      {/* 11 · live */}
      <section id="chain" className="border-t border-border bg-paper-deep/30 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4 md:px-5">
          <Reveal>
            <p className={eyebrow}>Live</p>
            <h2 className={`${h2} mt-4`}>Live on HSK Chain.</h2>
          </Reveal>
          <Reveal className="mt-12">
            <LiveStats />
          </Reveal>
          <details className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
            <summary className="cursor-pointer px-5 py-4 font-cond text-[13px] font-semibold uppercase tracking-[0.18em] text-muted">
              Six verified contracts
            </summary>
            <table className="w-full text-sm">
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
            <p className="px-5 py-3 text-[12px] text-muted">
              chainId 133 ·{" "}
              <a className="text-accent hover:underline" href={EXPLORER} target="_blank" rel="noreferrer">
                testnet-explorer.hskchain.net
              </a>
            </p>
          </details>
        </div>
      </section>

      {/* 12 · footer */}
      <footer className="grain relative overflow-hidden border-t border-border">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.18]" style={{ backgroundImage: "url(/fondo-blur.jpg)" }} aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-5">
          <h2 className={h2}>Try it on your phone.</h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/wallet" className="btn-sweep inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-deep">
              Open my passport
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full border border-foreground/30 px-6 text-[15px] font-semibold text-foreground hover:bg-surface">
              GitHub
            </a>
          </div>
          <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[
              ["Architecture", "docs/ARCHITECTURE.md"],
              ["JSON-RPC", "docs/RPC.md"],
              ["For agents", "docs/AGENTS.md"],
              ["Security", "docs/SECURITY.md"],
              ["Gate", "docs/GATE.md"],
            ].map(([t, p]) => (
              <li key={p}>
                <a className="text-foreground/80 hover:text-accent" href={`${REPO}/blob/main/${p}`} target="_blank" rel="noreferrer">
                  {t} →
                </a>
              </li>
            ))}
          </ul>
          <div className="rule mt-12" />
          <p className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
            <span>Passport Agent Protocol · Ethereum Builders Tour Cali · 2026</span>
            <span>@DevCristobalvc</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
