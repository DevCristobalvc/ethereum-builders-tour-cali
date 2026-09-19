import type { Metadata } from "next";
import Link from "next/link";
import { Flow, Reveal, Terminal } from "@/components/landing/motion";
import { LiveStats } from "@/components/landing/LiveStats";
import { Logo } from "@/components/ui";
import { ADDRESSES, EXPLORER, addrUrl, txUrl } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Passport Agent Protocol",
  description:
    "Human-in-the-loop authorization for AI agents on HSK Chain: ERC-8004 passport, visas from your phone with a passkey, one on-chain pay().",
};

const REPO = "https://github.com/DevCristobalvc/ethereum-builders-tour-cali";
/** Real transactions on HSK Chain testnet (133). */
const TX = {
  humanApproved: "0xe15228455c80cd4c6e9a2229ab774e5d36ebd9e1ce63cf19cdefcfaec7b04e23",
  agentAlone: "0x629de0c7927fe7a44796698f1bb8c56d6a6d0f67d3ea1cda19541bc8c15c756f",
};
const CONTRACTS: { name: string; key: keyof typeof ADDRESSES; role: string }[] = [
  { name: "IdentityRegistry", key: "IdentityRegistry", role: "ERC-8004 · agent ↔ human link" },
  { name: "AgentPassport", key: "AgentPassport", role: "visas · pay() · stamps" },
  { name: "DemoUSDT", key: "DemoUSDT", role: "test stablecoin" },
  { name: "ReputationRegistry", key: "ReputationRegistry", role: "ERC-8004 feedback" },
  { name: "PassportRegistry", key: "PassportRegistry", role: "ZK membership (roadmap)" },
  { name: "Groth16Verifier", key: "Groth16Verifier", role: "ZK verifier (roadmap)" },
];
const MARQUEE = [
  "ERC-8004 Identity",
  "Passkey · Face ID",
  "AgentPassport visas",
  "x402-style gate",
  "MCP · Claude Code",
  "HSK Chain testnet",
  "Human in the loop",
  "Autonomous inside the visa",
];

const eyebrow = "font-cond text-[12px] font-semibold uppercase tracking-[0.22em] text-accent";
const h2 = "font-serif text-4xl font-medium leading-[1.05] tracking-tight text-foreground md:text-6xl";
const pill = "btn-sweep inline-flex items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold transition";

export default function Landing() {
  return (
    <div className="relative">
      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Logo />
            <span className="font-cond text-[15px] font-semibold uppercase tracking-[0.16em]">Passport Agent Protocol</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#modes" className="hover:text-foreground">Two modes</a>
            <a href="#chain" className="hover:text-foreground">On-chain</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
          <Link href="/wallet" className={`${pill} !py-2 bg-accent text-white hover:bg-accent-deep`}>
            Open wallet
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="grain relative flex min-h-[100svh] items-end overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/fondo.jpg)" }} aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" aria-hidden />
        {/* the spark: fingertip contact point of the painting */}
        <div className="pointer-events-none absolute left-[49.6%] top-[50.2%] z-10" aria-hidden>
          <span className="ripple absolute h-16 w-16 rounded-full border border-accent-soft/60" />
          <span className="ripple d2 absolute h-16 w-16 rounded-full border border-accent-soft/60" />
          <span className="ripple d3 absolute h-16 w-16 rounded-full border border-accent-soft/60" />
          <span className="spark absolute h-5 w-5 rounded-full bg-[#fff2c8] shadow-[0_0_40px_14px_rgba(255,220,150,0.8),0_0_90px_40px_rgba(192,74,138,0.35)]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-32 md:pb-24">
          <p className={`${eyebrow} rise`}>Ethereum Builders Tour · Cali · HSK Chain</p>
          <h1 className="rise-2 mt-4 max-w-4xl font-serif text-[15vw] font-medium leading-[0.92] tracking-tight text-foreground md:text-[104px]">
            Your agent has a passport.
            <br />
            <em className="text-accent">You stamp the visas.</em>
          </h1>
          <p className="rise-3 mt-6 max-w-xl text-lg leading-relaxed text-foreground/80">
            Claude Code asks. Your iPhone decides with Face&nbsp;ID. HSK Chain executes, within a limit you set on-chain. The agent
            never sees a key.
          </p>
          <div className="rise-3 mt-8 flex flex-wrap gap-3">
            <Link href="/wallet" className={`${pill} bg-accent text-white hover:bg-accent-deep`}>
              Try it on your phone
            </Link>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className={`${pill} border border-foreground/30 bg-surface/60 text-foreground backdrop-blur hover:bg-surface`}
            >
              Read the code
            </a>
          </div>
        </div>
      </section>

      {/* marquee */}
      <div className="overflow-hidden border-y border-border bg-paper-deep/60 py-3">
        <div className="marquee flex w-max whitespace-nowrap font-cond text-[13px] font-semibold uppercase tracking-[0.22em] text-muted">
          {[0, 1].map((k) => (
            <span key={k} className="flex">
              {MARQUEE.map((t) => (
                <span key={t} className="flex items-center px-6">
                  {t} <span className="ml-12 text-accent">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* problem */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <Reveal>
          <p className={eyebrow}>№ 1 — The gap</p>
          <h2 className={`${h2} mt-4 max-w-3xl`}>Today an agent either holds your private key, or nothing at all.</h2>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {[
            ["A .env with a key", "Full custody. One bad tool call and the wallet is gone. No limits, no trail, no way to say no."],
            ["No key at all", "The agent can plan but never act. Every payment is copy-paste back to a human."],
            ["A passport", "Identity on-chain (ERC-8004), visas with limits and expiry, every action stamped. The human approves from a phone."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 120} className="bg-surface p-8">
              <p className="font-cond text-[12px] uppercase tracking-[0.2em] text-muted">0{i + 1}</p>
              <h3 className={`mt-2 font-serif text-3xl font-medium ${i === 2 ? "text-accent" : ""}`}>{t}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* how */}
      <section id="how" className="border-y border-border bg-paper-deep/40 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className={eyebrow}>№ 2 — How it works</p>
            <h2 className={`${h2} mt-4 max-w-3xl`}>A request travels. A human decides. The chain remembers.</h2>
          </Reveal>
          <Reveal className="mt-12 rounded-3xl border border-border bg-surface p-6 md:p-10">
            <Flow />
          </Reveal>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              [
                "Connect",
                "pap_connect shows a QR. Your iPhone creates a passkey wallet and registers the agent on HSK Chain as an ERC-8004 identity, with a visa: max amount, expiry.",
                "4 transactions · ≈ 0.0003 HSK",
              ],
              [
                "Approve",
                "Send 10 demoUSDT to María. The agent signs a request; the phone shows exactly what, to whom, how much. Face ID.",
                "0 keys ever leave the phone",
              ],
              [
                "Executed",
                "The phone calls AgentPassport.pay(). The visa limit is enforced by the contract, the action is stamped, the agent receives the tx hash and continues.",
                "1 transaction · 81k gas",
              ],
            ].map(([t, d, m], i) => (
              <Reveal key={t} delay={i * 120}>
                <p className="font-cond text-[12px] uppercase tracking-[0.2em] text-accent">Step {i + 1}</p>
                <h3 className="mt-2 font-serif text-3xl font-medium">{t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{d}</p>
                <p className="mt-3 font-mono text-[12px] text-foreground/70">{m}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* two modes + gate */}
      <section id="modes" className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <Reveal>
          <p className={eyebrow}>№ 3 — Two modes, one passport</p>
          <h2 className={`${h2} mt-4 max-w-3xl`}>Ask every time, or approve once and let it work inside the visa.</h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8">
            <span className="stamp-in absolute right-6 top-6 rounded-md border-2 border-accent px-2 py-0.5 font-cond text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">
              Approved · Face ID
            </span>
            <p className="font-cond text-[12px] uppercase tracking-[0.2em] text-muted">Mode A</p>
            <h3 className="mt-2 font-serif text-3xl font-medium">Human in the loop</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Every payment is a QR, a glance and a Face ID. Ideal for anything above your comfort line.
            </p>
            <a className="mt-6 inline-block font-mono text-[13px] text-accent hover:underline" href={txUrl(TX.humanApproved)} target="_blank" rel="noreferrer">
              10 demoUSDT approved from iPhone → tx {TX.humanApproved.slice(0, 10)}…
            </a>
          </Reveal>
          <Reveal delay={120} className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8">
            <span
              className="stamp-in absolute right-6 top-6 rounded-md border-2 border-ok px-2 py-0.5 font-cond text-[12px] font-semibold uppercase tracking-[0.2em] text-ok"
              style={{ animationDelay: "0.3s" }}
            >
              Inside visa · no prompt
            </span>
            <p className="font-cond text-[12px] uppercase tracking-[0.2em] text-muted">Mode B</p>
            <h3 className="mt-2 font-serif text-3xl font-medium">Autonomous inside the visa</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Grant once: up to 100 demoUSDT for 7 days. The agent pays by itself; the contract says no at 101.
            </p>
            <a className="mt-6 inline-block font-mono text-[13px] text-accent hover:underline" href={txUrl(TX.agentAlone)} target="_blank" rel="noreferrer">
              agent #6 paid alone → tx {TX.agentAlone.slice(0, 10)}…
            </a>
          </Reveal>
        </div>

        <div className="mt-20 grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className={eyebrow}>№ 4 — The border</p>
            <h2 className={`${h2} mt-4`}>Services check the visa, not the human.</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              An x402-shaped gate: <span className="font-mono text-foreground">402</span> with a challenge, the agent signs it with its identity key,
              the service verifies on HSK Chain that the key belongs to the ERC-8004 agent and that its visa is active.{" "}
              <span className="font-mono text-foreground">200</span>. No human, no bearer token, no shared secret.
            </p>
            <a className="mt-5 inline-block text-sm text-accent hover:underline" href={`${REPO}/blob/main/docs/GATE.md`} target="_blank" rel="noreferrer">
              docs/GATE.md →
            </a>
          </Reveal>
          <Reveal delay={150}>
            <Terminal />
          </Reveal>
        </div>
      </section>

      {/* on-chain */}
      <section id="chain" className="border-y border-border bg-paper-deep/40 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className={eyebrow}>№ 5 — Live on HSK Chain testnet</p>
            <h2 className={`${h2} mt-4 max-w-3xl`}>Six contracts, all verified. Numbers straight from the chain.</h2>
          </Reveal>
          <Reveal className="mt-12">
            <LiveStats />
          </Reveal>
          <Reveal className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {CONTRACTS.map((c) => {
                  const a = ADDRESSES[c.key];
                  return (
                    <tr key={c.name} className="hover:bg-background/60">
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
                      <td className="px-3 py-3 text-right">
                        <span className="rounded-full bg-ok/10 px-2 py-0.5 font-cond text-[11px] uppercase tracking-wider text-ok">verified</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-5 py-3 text-[12px] text-muted">
              chainId 133 · explorer{" "}
              <a className="text-accent hover:underline" href={EXPLORER} target="_blank" rel="noreferrer">
                testnet-explorer.hskchain.net
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* zero install */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <Reveal>
            <p className={eyebrow}>№ 6 — Zero install</p>
            <h2 className={`${h2} mt-4`}>Any MCP agent. One file.</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              The server is a single bundled file. Clone, open Claude Code, approve the <span className="font-mono text-foreground">pap</span> server.
              Cursor and Claude Desktop work the same way.
            </p>
          </Reveal>
          <Reveal delay={120} className="rounded-2xl border border-border bg-surface p-6 font-mono text-[13px] leading-7">
            <div className="text-muted">$ git clone {REPO.replace("https://", "")}</div>
            <div className="text-muted">$ cd ethereum-builders-tour-cali &amp;&amp; claude</div>
            <div className="mt-3 text-foreground">› connect my agent</div>
            <div className="text-muted">&nbsp;&nbsp;↳ pap_connect · QR on screen · Face ID on iPhone</div>
            <div className="mt-1 text-foreground">› send 10 demoUSDT to maria</div>
            <div className="text-muted">&nbsp;&nbsp;↳ pap_transfer · approved · tx 0xe1522845…</div>
            <div className="mt-1 text-foreground">› get the oracle price</div>
            <div className="text-accent">&nbsp;&nbsp;↳ pap_call_gate · ACCESS GRANTED (visa verified on-chain)</div>
          </Reveal>
        </div>
      </section>

      {/* footer */}
      <footer className="grain relative overflow-hidden border-t border-border">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.18]" style={{ backgroundImage: "url(/fondo-blur.jpg)" }} aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <p className={eyebrow}>Tracks</p>
              <p className="mt-3 font-serif text-2xl">EAG — AI × Ethereum &amp; Agent Economy</p>
              <p className="mt-1 font-serif text-2xl">HSK Chain — AI Agents · Payments</p>
            </div>
            <div>
              <p className={eyebrow}>Read</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {[
                  ["Architecture", "docs/ARCHITECTURE.md"],
                  ["Gate (x402-style)", "docs/GATE.md"],
                  ["Security & limitations", "docs/SECURITY.md"],
                  ["Contracts & gas", "contracts/README.md"],
                  ["State of the art (ZK roadmap)", "docs/STATE_OF_THE_ART.md"],
                ].map(([t, p]) => (
                  <li key={p}>
                    <a className="text-foreground/80 hover:text-accent" href={`${REPO}/blob/main/${p}`} target="_blank" rel="noreferrer">
                      {t} →
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={eyebrow}>Try</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/wallet" className={`${pill} bg-accent text-white hover:bg-accent-deep`}>
                  Open wallet on your phone
                </Link>
                <a href={REPO} target="_blank" rel="noreferrer" className={`${pill} border border-foreground/30 text-foreground hover:bg-surface`}>
                  GitHub
                </a>
              </div>
            </div>
          </div>
          <div className="rule mt-14" />
          <p className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
            <span>Passport Agent Protocol · Ethereum Builders Tour Cali · Sep 2026</span>
            <span>Cristóbal Valencia · @DevCristobalvc</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
