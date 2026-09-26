"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { addrUrl, txUrl } from "@/lib/chain";

export const short = (a?: string, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="11" r="3" stroke="var(--accent)" strokeWidth="1.8" />
      <path d="M8 17.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Shell({ children, title, back }: { children: ReactNode; title?: string; back?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-3 flex flex-col gap-4">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <Logo />
          <span className="font-semibold tracking-tight">{title ?? "Passport"}</span>
        </Link>
        {back && (
          <Link href="/wallet" className="text-sm text-muted hover:text-foreground">
            Wallet
          </Link>
        )}
      </header>
      {children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-border bg-surface p-5 ${className}`}>{children}</section>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  const base = "w-full rounded-full px-5 py-3.5 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40";
  const v =
    variant === "primary"
      ? "bg-foreground text-white hover:bg-black"
      : variant === "danger"
        ? "bg-transparent text-bad hover:bg-bad/5"
        : "border border-border bg-surface text-foreground hover:bg-background";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v}`}>
      {children}
    </button>
  );
}

export function Row({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm border-t border-border first:border-0">
      <span className="text-muted">{k}</span>
      <span className={`text-right ${mono ? "break-all font-mono text-[13px]" : "break-words"}`}>{v}</span>
    </div>
  );
}

export const TxLink = ({ hash }: { hash: string }) => (
  <a className="text-accent hover:underline" href={txUrl(hash)} target="_blank" rel="noreferrer">
    {short(hash, 6)}
  </a>
);
export const AddrLink = ({ addr }: { addr: string }) => (
  <a className="text-accent hover:underline" href={addrUrl(addr)} target="_blank" rel="noreferrer">
    {short(addr)}
  </a>
);

export function Status({ s }: { s: string }) {
  const c =
    s === "approved" || s === "done"
      ? "bg-ok/10 text-ok"
      : s === "rejected" || s === "expired" || s === "error"
        ? "bg-bad/10 text-bad"
        : "bg-accent/10 text-accent";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${c}`}>{s}</span>;
}

export function Notice({ children, kind = "info" }: { children: ReactNode; kind?: "info" | "error" | "ok" }) {
  const c =
    kind === "error" ? "bg-bad/5 text-bad" : kind === "ok" ? "bg-ok/10 text-ok" : "bg-background text-muted border border-border";
  return <div className={`rounded-2xl px-4 py-3 text-sm break-words [overflow-wrap:anywhere] ${c}`}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{children}</span>;
}

export const inputCls =
  "mt-1 w-full rounded-2xl border border-border bg-surface px-4 py-3 font-mono text-[15px] outline-none focus:border-accent";
