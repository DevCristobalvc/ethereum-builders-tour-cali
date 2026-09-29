import { TOKEN_SYMBOL } from "./chain";
import type { Action } from "./types";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** One-line, plain-language summary of what an agent asks for (lists, QR screen, history). */
export function summarize(a: Action): { tag: string; title: string; detail: string } {
  switch (a.type) {
    case "transfer":
      return { tag: "Payment", title: `Send ${a.amount} ${TOKEN_SYMBOL}`, detail: `to ${short(a.to)}` };
    case "reveal":
      return { tag: "Secret", title: `Read secret “${a.name}”`, detail: a.reason };
    case "seal":
      return { tag: "Seal", title: `Store secret “${a.name}”`, detail: `${a.maxReads} reads until ${new Date(Number(a.expiry) * 1000).toLocaleDateString()}` };
  }
}
