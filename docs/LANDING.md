# Landing storyboard (PAP-21)

**Goal:** someone who reads only the headlines understands PAP in 5 seconds. One sentence per screen, at most one supporting line. Mobile first (390 px), then desktop.

**Reference:** Hermes Agent (Nous Research) as described by the product owner — a page that tells a story as you scroll, scroll-triggered reveals, infinite loops, a terminal that types, very little text. The official site could not be opened from the build environment (network policy), so the concrete effects below are ours, not copied: *scroll-driven story with a sticky phone*, *diagram that draws itself with scroll*, *two-row infinite marquee*, *typing terminal*, *stamp animations*. Identity stays PAP's: renaissance hero (Creation of Adam, the spark at the fingertips), paper grain, Cormorant + Barlow Condensed, vino accent.

## Story (in order)

| # | Screen | Headline (≤ 12 words) | Support (≤ 20 words) | Motion | Mobile |
|---|---|---|---|---|---|
| 0 | Hero | **Your agent has a passport. You stamp the visas.** | Payments and API keys, approved from your phone. Enforced on-chain. | spark + ripples on the fingertips, headline rises | CTA "Open my passport" (phone) vs "Install in your agent" (desktop) |
| 1 | Marquee | — | Claude Code · Cursor · cast · viem · ethers · MCP · JSON-RPC · ERC-8004 · x402 · HSK Chain | two rows, opposite directions, pause on hover/tap | same |
| 2 | Problem | **A key in `.env` is a blank check.** | Full access, forever, one prompt injection away. | the `.env` line gets struck through, a passport appears | stacked |
| 3 | Story · Passport | **Your agent gets an identity, not a key.** | ERC-8004 on HSK Chain. You own it. | sticky phone shows the pairing QR | inline phone per step |
| 4 | Story · Visa | **You decide how much, and until when.** | A visa: scope, limit, expiry — in the contract. | phone shows the visa bar filling | " |
| 5 | Story · Face ID | **Anything sensitive goes through your phone.** | The agent asks. You read it. Face ID. | phone shows the approval card, stamp "APPROVED" | " |
| 6 | Story · Secrets | **Your API keys, sealed with two signatures.** | Its signature + your Face ID. The server only sees ciphertext. | phone shows "Read secret openai" + reason | " |
| 7 | Story · Chain | **The contract says no. Not the app.** | Over the limit → `LimitExceeded()`. Every action stamped. | stamps drop into the passport | " |
| 8 | How it works | **Who signs what.** | — | diagram draws itself with scroll; tabs Payments / Secrets; nodes light up | vertical diagram |
| 9 | Install | **Install it in your agent.** | One command. | tabs Claude Code / Cursor / Any agent / CLI, copy buttons, typing terminal | tabs scroll horizontally |
| 10 | Credentials | **Hand over a key without handing it over.** | Seal it on your laptop. It opens only when you approve. | 3 steps light up in order; phone card | stacked |
| 11 | Live | **Live on HSK Chain.** | Numbers straight from the chain. | live counters | 2×2 grid |
| 12 | Footer | **Try it on your phone.** | — | — | big thumb-reachable CTA |

## Rules

- `prefers-reduced-motion`: every animation has a static end state; nothing important is only visible mid-animation.
- No layout shift: animated elements reserve their space.
- No new animation library: IntersectionObserver + CSS (+ one scroll-progress hook for the diagram).
- Colors only from the theme tokens in `globals.css`.
