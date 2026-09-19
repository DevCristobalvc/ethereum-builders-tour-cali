import type { Metadata } from "next";
import Link from "next/link";
import { ADDRESSES, txUrl } from "@/lib/chain";
import { AddrLink, Card, Label, Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: "Passport Agent Protocol",
  description:
    "Human-in-the-loop authorization for AI agents on HashKey Chain: ERC-8004 passport, visas from your phone, one on-chain pay().",
};

const REPO = "https://github.com/DevCristobalvc/ethereum-builders-tour-cali";

/** Real transactions on HSK Chain testnet (133). */
const TX = {
  humanApproved: "0xe15228455c80cd4c6e9a2229ab774e5d36ebd9e1ce63cf19cdefcfaec7b04e23", // 10 demoUSDT approved from iPhone
  agentAlone: "0x629de0c7927fe7a44796698f1bb8c56d6a6d0f67d3ea1cda19541bc8c15c756f", // agentId 6 pays inside its visa, no human
};

const CONTRACTS: { key: keyof typeof ADDRESSES; name: string; role: string }[] = [
  { key: "IdentityRegistry", name: "IdentityRegistry", role: "ERC-8004 identity — agent is an ERC-721 owned by the human" },
  { key: "AgentPassport", name: "AgentPassport", role: "The visa — grant / revoke / pay / record, limit + expiry on-chain" },
  { key: "DemoUSDT", name: "DemoUSDT", role: "6-decimal demo stablecoin, public faucet()" },
  { key: "ReputationRegistry", name: "ReputationRegistry", role: "ERC-8004 feedback" },
  { key: "PassportRegistry", name: "PassportRegistry", role: "ZK anonymous passport (iteration 3)" },
  { key: "Groth16Verifier", name: "Groth16Verifier", role: "Groth16 verifier for the ZK passport" },
];

const pill = "inline-flex items-center justify-center rounded-full px-5 py-3 text-[15px] font-semibold transition";
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-[13px] font-semibold text-accent">
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        <div className="text-sm text-muted">{children}</div>
      </div>
    </li>
  );
}

export default function Landing() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-3 flex flex-col gap-4">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <Logo />
          <span className="font-semibold tracking-tight">Passport Agent Protocol</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
          <Link href="/wallet" className="hover:text-foreground">
            Wallet
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col gap-5 py-8 sm:py-12">
        <div className="text-accent">
          <Logo size={44} />
        </div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Your agent has a passport.
          <br />
          You stamp the visas.
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Human-in-the-loop authorization for AI agents. The agent asks, you approve with Face ID, HSK Chain enforces the
          limit. The agent never holds a private key.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/wallet" className={`${pill} bg-foreground text-white hover:bg-black`}>
            Try it on your phone
          </Link>
          <a href={REPO} target="_blank" rel="noreferrer" className={`${pill} border border-border bg-surface text-foreground hover:bg-background`}>
            Read the code
          </a>
        </div>
        <p className="text-[13px] text-muted">
          Built at Ethereum Builders Tour: Cali · Sep 19–20, 2026 · Ethereum Applications Guild × HashKey Chain × ETH Cali
        </p>
      </section>

      {/* Problem */}
      <Card className="flex flex-col gap-3">
        <Label>Problem</Label>
        <H2>An agent with a key in .env can do everything. Without one, nothing.</H2>
        <p className="text-sm text-muted">
          Today an AI agent (Claude Code, a trading bot, an A2A worker) either holds a private key — and can drain the
          wallet on one prompt injection — or holds nothing and you copy-paste transactions by hand. There is no way for a
          human to approve <em>this specific action</em> from a device they trust, with a verifiable on-chain record of
          who authorized which agent to do what.
        </p>
      </Card>

      {/* How it works */}
      <Card className="flex flex-col gap-4">
        <Label>How it works</Label>
        <ol className="flex flex-col gap-5">
          <Step n={1} title="Connect">
            <p>
              The agent calls the <span className="font-mono">pap_connect</span> MCP tool and shows a QR. Your phone signs
              the onboarding — 4 transactions, you are the owner of the passport:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-[13px]">
              <li>IdentityRegistry.register(agentURI, agentWallet)</li>
              <li>DemoUSDT.faucet()</li>
              <li>DemoUSDT.approve(AgentPassport, max)</li>
              <li>AgentPassport.grant(agentId, scope, limit, expiry)</li>
            </ul>
          </Step>
          <Step n={2} title="Approve with Face ID">
            <p>
              The agent calls <span className="font-mono">pap_transfer</span>. Your phone shows the request in plain
              language — who, how much, to whom, against which visa — and asks for Face ID. The key never leaves the
              device: a WebAuthn passkey (with the PRF extension on iOS 18+) encrypts it.
            </p>
          </Step>
          <Step n={3} title="Executed on HSK Chain">
            <p>
              One transaction: <span className="font-mono">AgentPassport.pay(agentId, token, to, amount, ref)</span>. The
              contract checks scope, limit and expiry, moves the tokens and records the usage. Over the limit? It reverts
              with <span className="font-mono">LimitExceeded()</span> — the rule is on-chain, not in the app.
            </p>
          </Step>
        </ol>
      </Card>

      {/* Two modes */}
      <Card className="flex flex-col gap-4">
        <Label>Two modes, same visa</Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Human in the loop</p>
            <p className="text-sm text-muted">
              Every payment is approved on the phone. 10 demoUSDT approved from an iPhone via MCP; 500 demoUSDT rejected
              on-chain.
            </p>
            <a className="font-mono text-[13px] text-accent hover:underline" href={txUrl(TX.humanApproved)} target="_blank" rel="noreferrer">
              {short(TX.humanApproved)}
            </a>
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="font-semibold">Autonomous, inside the visa</p>
            <p className="text-sm text-muted">
              The human grants once; afterwards the agent key pays alone. Limit and expiry are still enforced by the
              contract — agentId 6 paid 10 demoUSDT with no human signature.
            </p>
            <a className="font-mono text-[13px] text-accent hover:underline" href={txUrl(TX.agentAlone)} target="_blank" rel="noreferrer">
              {short(TX.agentAlone)}
            </a>
          </div>
        </div>
      </Card>

      {/* Live contracts */}
      <Card className="flex flex-col gap-3">
        <Label>Live on HSK Chain testnet · chainId 133</Label>
        <H2>Six contracts, all verified on Blockscout</H2>
        <div className="flex flex-col">
          {CONTRACTS.map((c) => {
            const addr = ADDRESSES[c.key];
            return (
              <div key={c.key} className="flex items-start justify-between gap-3 border-t border-border py-3 text-sm first:border-0">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[13px] font-semibold">{c.name}</span>
                  <span className="text-[13px] text-muted">{c.role}</span>
                </div>
                <span className="shrink-0 font-mono text-[13px]">{addr ? <AddrLink addr={addr} /> : "—"}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tracks */}
      <Card className="flex flex-col gap-3">
        <Label>Tracks</Label>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">EAG — AI × Ethereum &amp; Agent Economy</p>
            <p className="text-muted">Agent wallets and agent payments with a verifiable human in the loop, on ERC-8004.</p>
          </div>
          <div className="border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="font-semibold">HashKey Chain — AI Agents / Payments</p>
            <p className="text-muted">Compliant but private: an auditable authorization trail without exposing identities.</p>
          </div>
        </div>
      </Card>

      {/* Roadmap */}
      <Card className="flex flex-col gap-3">
        <Label>What&apos;s next</Label>
        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li>
            <span className="font-semibold text-foreground">Iteration 2 — x402-style gate (live).</span>{" "}
            <span className="font-mono">GET /api/gate/oracle</span> answers 402 with a challenge; the agent signs it, the
            gate checks the agent wallet on <span className="font-mono">IdentityRegistry</span> and{" "}
            <span className="font-mono">canAct()</span> on-chain, and answers 200. See docs/GATE.md.
          </li>
          <li>
            <span className="font-semibold text-foreground">Iteration 3 — ZK passport.</span> Prove &ldquo;I am an
            authorized agent&rdquo; with a Groth16 membership proof without revealing which one. Verifier and registry are
            already deployed.
          </li>
          <li>
            <span className="font-semibold text-foreground">Later.</span> RIP-7212 / account abstraction so the passkey
            signs on-chain directly; agent-to-agent payments.
          </li>
        </ul>
      </Card>

      {/* Links */}
      <Card className="flex flex-col gap-3">
        <Label>Links</Label>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <a className="text-accent hover:underline" href={REPO} target="_blank" rel="noreferrer">
              Repository — contracts, web, MCP server
            </a>
          </li>
          <li>
            <a className="text-accent hover:underline" href={`${REPO}/blob/main/docs/PITCH.md`} target="_blank" rel="noreferrer">
              Pitch &amp; Q&amp;A
            </a>
          </li>
          <li>
            <a className="text-accent hover:underline" href={`${REPO}/blob/main/docs/STATE_OF_THE_ART.md`} target="_blank" rel="noreferrer">
              State of the art — ERC-8004, x402, ZK credentials
            </a>
          </li>
          <li>
            <a className="text-accent hover:underline" href={`${REPO}/blob/main/docs/GATE.md`} target="_blank" rel="noreferrer">
              Gate — x402-shaped visa check (iteration 2)
            </a>
          </li>
          <li>
            <a className="text-accent hover:underline" href={`${REPO}/blob/main/contracts/README.md`} target="_blank" rel="noreferrer">
              Contracts README — addresses, tests, cast recipes
            </a>
          </li>
          <li>
            <Link className="text-accent hover:underline" href="/wallet">
              Wallet — the phone side of the protocol
            </Link>
          </li>
        </ul>
        <p className="pt-2 text-[13px] text-muted">Team: Cristóbal Valencia (@DevCristobalvc) · Juan · William</p>
      </Card>
    </main>
  );
}
