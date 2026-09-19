"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { addrUrl, txUrl } from "@/lib/chain";

export const short = (a?: string, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");

export function Shell({ children, title, back }: { children: ReactNode; title?: string; back?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4 flex flex-col gap-4">
      <header className="flex items-center gap-3 py-2">
        {back && (
          <Link href="/" className="text-muted text-sm">
            ← Home
          </Link>
        )}
        <div className="flex items-center gap-2">
          <span className="inline-block h-6 w-6 rounded-md border-2 border-accent" />
          <span className="font-semibold tracking-tight">{title ?? "Passport Agent Protocol"}</span>
        </div>
      </header>
      {children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-4 ${className}`}>{children}</section>;
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
  const base = "w-full rounded-xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.99] disabled:opacity-50";
  const v =
    variant === "primary"
      ? "bg-accent text-[#0b1220]"
      : variant === "danger"
        ? "border border-bad text-bad"
        : "border border-border text-foreground";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v}`}>
      {children}
    </button>
  );
}

export function Row({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{k}</span>
      <span className={`text-right break-all ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  );
}

export const TxLink = ({ hash }: { hash: string }) => (
  <a className="text-accent underline" href={txUrl(hash)} target="_blank" rel="noreferrer">
    {short(hash, 6)}
  </a>
);
export const AddrLink = ({ addr }: { addr: string }) => (
  <a className="text-accent underline" href={addrUrl(addr)} target="_blank" rel="noreferrer">
    {short(addr)}
  </a>
);

export function Status({ s }: { s: string }) {
  const color =
    s === "approved" || s === "done" ? "text-ok" : s === "rejected" || s === "expired" || s === "error" ? "text-bad" : "text-accent";
  return <span className={`font-mono text-xs uppercase ${color}`}>{s}</span>;
}

export function Notice({ children, kind = "info" }: { children: ReactNode; kind?: "info" | "error" | "ok" }) {
  const c = kind === "error" ? "border-bad text-bad" : kind === "ok" ? "border-ok text-ok" : "border-border text-muted";
  return <div className={`rounded-xl border px-3 py-2 text-sm ${c}`}>{children}</div>;
}
