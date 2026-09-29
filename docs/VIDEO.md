# Plan B video — storyboard (2:00)

> To record once the E2E flow works. It is the backup for the showcase and the video for the Devfolio submission (unlisted YouTube link).

## Recording setup

| Source | Tool | Notes |
|---|---|---|
| Laptop (terminal + browser) | OBS (Windows) or QuickTime "New Screen Recording" (Mac) | 1920×1080, 30 fps. Terminal font ≥ 18 pt, light theme. Close notifications. |
| iPhone | Native screen recording (Control Center → Screen Recording) | Microphone off. Brightness at maximum. Do not disturb. |
| Voice-over | Record separately with the phone (Voice Memos) or in OBS at the end | Record the voice **afterwards**, watching the silent video, so the timing matches. |

**Editing:** CapCut / iMovie / DaVinci. Laptop full screen; the iPhone comes in as *picture-in-picture* on the right (≈ 30 % of the height) only in the shots where it is used. No music, or very quiet music. English subtitles recommended (the EAG / HSK judges are international): put each shot's line as a subtitle.

**Before recording:** `pap_connect` done, visa with a limit of 100 (not expired), contact `oracle` added, wallet with gas, explorer open on `AgentPassport`. Rehearse once without recording. Record the full flow **twice** and keep the better take.

---

## Storyboard

| # | Time | Screen | What is seen | Voice-over |
|---|---|---|---|---|
| 1 | 0:00–0:08 | Title (white page, logo, text) | "Passport Agent Protocol" · "Your agent has a passport. You stamp the visas." · Ethereum Builders Tour Cali · HashKey Chain | *Passport Agent Protocol. Your agent has a passport: you stamp its visas from your phone, and services let it through without knowing who you are.* |
| 2 | 0:08–0:22 | Terminal: `cat .env` → no `PRIVATE_KEY` | Claude Code open in the repo; `.mcp.json` shows the `pap` server | *Today an AI agent has two options: a private key in a dot-env, with which it can do everything... or nothing. There is no middle ground. This agent has no key at all. It has one tool: asking for permission.* |
| 3 | 0:22–0:32 | Terminal: the prompt is typed | `Pay 5 demoUSDT to oracle for the price query.` → Claude calls `pap_transfer` | *I ask it to pay five demo-USDT to an oracle. The agent calls the MCP tool `pap_transfer`.* |
| 4 | 0:32–0:40 | Browser: `/show/request/:id` with the big QR | The MCP opens the QR by itself | *A QR code appears. This goes to my phone.* |
| 5 | 0:40–0:58 | iPhone (large PiP): camera → PWA `/approve/:id` | Screen: "Claude Code wants to send 5 demoUSDT to oracle · visa transfer:demoUSDT · limit 100 · used 10" | *On the phone I see exactly what it wants to do, in plain language: who, how much, to whom, and the visa I gave it with its limit.* |
| 6 | 0:58–1:06 | iPhone: tap Approve → Face ID → "Sent" + hash | Face ID animation | *I approve with Face ID. The phone signs a single transaction: `AgentPassport.pay`. The key never leaves the device.* |
| 7 | 1:06–1:16 | Terminal: Claude receives `{txHash, explorerUrl}` and replies | "Payment sent — https://testnet-explorer.hskchain.net/tx/0x…" | *The agent gets the hash and keeps working. Human in the loop, in fifteen seconds, from the phone.* |
| 8 | 1:16–1:28 | Browser: explorer → the transaction → `Paid` event → `AgentPassport` contract → `PermissionGranted` | Zoom on the event | *And everything is on-chain on HashKey: the ERC-8004 registration where I own the passport, the visa with its limit, and the recorded payment.* |
| 9 | 1:28–1:42 | Terminal: `Now pay 500 demoUSDT to oracle` → QR → iPhone: Approve → transaction **reverts** with `LimitExceeded()` | Show the error on the phone and in the explorer | *And if the agent asks for more than the limit? I approve anyway... and the contract reverts. The limit is not a server rule: it belongs to the contract.* |
| 10 | 1:42–1:52 | Slide: "Two modes" with both transactions | Human-in-the-loop `0xe152…` · Autonomous inside the visa `0x629de0…` | *Same visa, two modes: approve every payment from the phone, or grant a visa once and let the agent operate on its own inside it. Either way, the contract is in charge.* |
| 11 | 1:52–2:00 | Closing slide: logo + `pap.devcristobalvc.com` + repo + "Compliant but private · HashKey Chain" | One-line roadmap: x402 gate → ZK passport | *Any service can verify that there is a real human behind this agent, without knowing who it is. Compliant but private. Passport Agent Protocol.* |

Total: **2:00**.

---

## Full voice-over (to read straight through)

> Passport Agent Protocol. Your agent has a passport: you stamp its visas from your phone, and services let it through without knowing who you are.
>
> Today an AI agent has two options: a private key in a dot-env, with which it can do everything... or nothing. There is no middle ground. This agent has no key at all. It has one tool: asking for permission.
>
> I ask it to pay five demo-USDT to an oracle. The agent calls the MCP tool `pap_transfer`. A QR code appears. This goes to my phone.
>
> On the phone I see exactly what it wants to do, in plain language: who, how much, to whom, and the visa I gave it with its limit. I approve with Face ID. The phone signs a single transaction: `AgentPassport.pay`. The key never leaves the device.
>
> The agent gets the hash and keeps working. Human in the loop, in fifteen seconds, from the phone.
>
> And everything is on-chain on HashKey: the ERC-8004 registration where I own the passport, the visa with its limit, and the recorded payment.
>
> And if the agent asks for more than the limit? I approve anyway... and the contract reverts. The limit is not a server rule: it belongs to the contract.
>
> Same visa, two modes: approve every payment from the phone, or grant a visa once and let the agent operate on its own inside it. Either way, the contract is in charge.
>
> Any service can verify that there is a real human behind this agent, without knowing who it is. Compliant but private. Passport Agent Protocol.

(≈ 200 words · about 1:50 at a normal pace; leave some air in shots 4 and 6.)

---

## Slides to make (3)

1. **Title** (shot 1): white page, logo, "Passport Agent Protocol", anchor line, "Ethereum Builders Tour: Cali · EAG × HashKey Chain".
2. **Two modes** (shot 10): two columns with both transactions and their links.
3. **Close** (shot 11): logo, `pap.devcristobalvc.com`, `github.com/DevCristobalvc/ethereum-builders-tour-cali`, "Compliant but private", one-line roadmap.

Build them in Figma / Keynote / Google Slides with the same tokens as the website (white-paper style): page `#fbfaf7`, ink `#16181d`, single accent `#1f3b63`, Source Serif 4 for titles, IBM Plex Sans for text, IBM Plex Mono for code. No emojis.

---

## Delivery

- Export 1080p, H.264, ≤ 100 MB.
- Keep a local copy at `docs/demo.mp4` (**do not** commit it if it is over 50 MB) + a copy on the phone.
- Upload to YouTube as **unlisted**, titled "Passport Agent Protocol — Ethereum Builders Tour Cali 2026", and paste the link into `docs/SUBMISSION.md` and Devfolio.
- If there is no time to edit: upload the raw laptop take with the voice-over on top; the iPhone on camera is enough.
