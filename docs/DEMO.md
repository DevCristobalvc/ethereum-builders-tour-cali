# Live demo — Passport Agent Protocol

> Target length: **75 seconds** of demo inside the 3-minute pitch. Rehearse at least 3 times before going on stage.

## What is on screen

| Screen | What it shows |
|---|---|
| Laptop (projector) | Terminal with Claude Code at a large font (>= 18 pt) + the `/show/request/:id` tab (big QR, the MCP opens it by itself) + an explorer tab on `testnet-explorer.hskchain.net` |
| iPhone (mirrored with QuickTime, or the laptop camera pointed at it) | The PWA at `pap.devcristobalvc.com` |

If the iPhone cannot be mirrored: point the laptop camera at the phone and keep the camera window in a quarter of the screen.

---

## Pre-flight checklist (one hour before going on stage)

- [ ] Laptop charged, "do not disturb" on, brightness at maximum, large terminal font, light theme
- [ ] iPhone charged, brightness at maximum, airplane mode **off**, mobile data on (do not depend on the venue Wi-Fi)
- [ ] PWA installed on the iPhone (Safari → Share → Add to Home Screen), passkey created, session open
- [ ] The phone address has **HSK for gas** (`/api/fund` sends 0.002 HSK when the wallet is created; if it ran out, use the faucet at https://hskchain.net/faucet) and **demoUSDT** (onboarding calls `faucet()` = 1000)
- [ ] `pap_connect` done the day before: 4-transaction onboarding from the phone (`register` → `faucet` → `approve` → `grant` with a limit of 100). None of this on demo day. Check with `pap_status`; the visa must not be expired
- [ ] Relay deployed on Vercel and answering (`curl https://pap.devcristobalvc.com/api/health`)
- [ ] MCP `pap` loaded (Claude Code plugin `pap@pap`, or `.mcp.json` at the repo root: `claude mcp list` → `pap … Connected`), `~/.pap/agent.json` present
- [ ] Contact `oracle` added (`pap_contact_add`) so you can say "pay 5 demoUSDT to oracle"
- [ ] `pap_call_gate` tried once against production (closing beat B)
- [ ] `/wallet` on the iPhone shows the agent under **Agents** with the visa bar and at least one stamp under **Stamps** (stamps are read from HSK Chain and take a few seconds to appear after the transaction)
- [ ] Explorer open on `AgentPassport` `0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B` (tab ready and loaded)
- [ ] Phone simulator ready in another terminal (`node web/scripts/phone-sim.mjs`): plan B if the iPhone fails live
- [ ] Plan B video downloaded **locally** (do not depend on YouTube or Wi-Fi), open in a player and paused
- [ ] Phone hotspot ready as the laptop's backup internet
- [ ] A second team member with the repo open in case code has to be shown during Q&A

---

## Step by step (who does what)

**Cristóbal runs everything: narration, keyboard and phone.** (Rehearse the hand-off from laptop to phone.)

### 1. Context (10 s)
Terminal already open with Claude Code in the repo. Say: *"This is Claude Code, a real agent, with no private key configured."*

Optional: show `cat .env` → there is no `PRIVATE_KEY`. Technical judges notice this detail.

### 2. Ask the agent (10 s)
Type in Claude Code:

```
Pay 5 demoUSDT to oracle for the price query.
```
(`oracle` is a contact added with `pap_contact_add`; a 0x address works too.)

Claude decides to call `pap_transfer`. Narrate: *"The agent cannot pay. All it can do is ask for permission."*

### 3. QR in the terminal (5 s)
The ASCII QR appears in the terminal and the MCP opens `/show/request/:id` in the browser (big QR; use this one on the projector). Narrate: *"This goes to my phone."*

### 4. Approval on the iPhone (20 s)
Scan the QR with the camera → it opens the PWA at `/approve/:id`:

> **Claude Code** wants to send **5 demoUSDT** to `0x…abcd`
> Visa: `transfer:demoUSDT` · limit 100 · used 0
> [ Approve ] [ Reject ]

Narrate: *"I see exactly what it wants to do, in plain language, and the limit I gave it."*
Tap **Approve** → Face ID → the phone signs **one** `AgentPassport.pay()` transaction on HashKey Chain → "Sent" + hash.

### 5. The agent carries on (15 s)
Back to the laptop: Claude received `{txHash, explorerUrl}` and continues: *"Payment sent, here is the link."*
Click the link → explorer tab with the confirmed transaction (HashKey testnet confirms in about 2 s).

Narrate: *"Human in the loop, 15 seconds, from the phone. The agent never touched a key."*

**Visual beat (5 s, recommended):** on the iPhone, open `/wallet` → **Stamps** tab: the new stamp appears (amount, recipient, transaction, executed by *you*). Under **Agents**, the visa spending bar moved (5 / 100). Narrate: *"And the passport has a new stamp, read straight from the chain."*

### 6. What is on-chain (15 s)
Switch to the `AgentPassport` contract tab in the explorer → `PermissionGranted` and `Paid` events (and, on `IdentityRegistry`, `Registered` with owner = the phone).

**Optional closing beat A (10 s):** ask Claude *"now pay 500 demoUSDT to oracle"* → approve on the phone → the transaction **reverts** with `LimitExceeded()`. Narrate: *"The limit is not a server rule, it is the contract's."* (Already tested: it works.)

**Optional closing beat B (10 s, iteration 2):** *"call the protected oracle"* → `pap_call_gate` → the terminal shows `402` → signed challenge → `200 ACCESS GRANTED`, **without touching the phone**. Narrate: *"And once the visa exists, the agent crosses borders on its own: 402, signature, 200. x402-style, no facilitator."*
Narrate: *"Any service can verify that this agent is authorized by a real human, with a scope and a limit, without knowing who the human is. Compliant but private."*

→ Back to the pitch script (roadmap and close).

---

## Plan B1 — phone simulator (if the iPhone fails)

`node web/scripts/phone-sim.mjs approve <requestId>` in a separate terminal approves requests as if it were the phone (it signs with a test wallet). The Claude → MCP → relay → chain flow looks the same; only the Face ID part is lost. Say: *"The phone is not getting along with the Wi-Fi, so here is the same flow with the simulator. The contract is the same."*

## Plan B2 — video (if everything fails)

Record the evening before (the E2E flow already works).

- **Format:** laptop screen recording (OBS or Win+G) with the iPhone mirrored or on camera. 60–75 s. No music, no voice (narrate live over it).
- **Content:** exactly steps 2 → 6 above, no cuts.
- **Store:** `docs/demo.mp4` (do not commit it if it is over 50 MB; keep it on the laptop desktop and on the phone) + upload to YouTube as *unlisted* for the Devfolio submission.

**Triggers to switch to plan B (do not hesitate, decide within 5 seconds):**
- The QR does not open the PWA, or the PWA does not load within 10 s
- Face ID fails twice
- The transaction does not show up in the explorer within 20 s
- The MCP does not answer / Claude does not call the tool

Say: *"Here is this morning's recording while the network makes up its mind"* and press play. Keep narrating the same way.

---

## Known failures and what to do

| Symptom | Likely cause | Quick fix |
|---|---|---|
| Claude does not call `pap_transfer` | MCP not connected / plugin or `.mcp.json` not loaded | `claude mcp list`; restart Claude Code from the repo root; more explicit prompt: "use the pap_transfer tool" |
| `pap_transfer` says there is no agent | `~/.pap/agent.json` missing | Run `pap_connect` (should already be done the day before) |
| QR opens but the PWA says "request not found" | Relay restarted (in-memory) or a different URL | Repeat step 2; check `PAP_RELAY_URL` in the MCP |
| Phone signs but the transaction reverts with `LimitExceeded` / expired | Rehearsals used up the limit, or the grant expired | `revoke` + `grant` again from the phone (or redo `pap_connect`); check `getGrant` in the explorer. Rehearse with small amounts (1–5) so the 100 are not used up |
| Phone has no gas | `/api/fund` already sent its 0.002 HSK and it was spent (it funds each address once) | Faucet at https://hskchain.net/faucet or send HSK from the deployer wallet |
| "insufficient funds" on the phone | No HSK for gas | If the faucet will not give more that day → use the backup address (fund it the day before) |
| Transaction sent but Claude keeps waiting | Polling (up to 5 min) / the relay did not receive `resolve` | Show the hash from the phone in the explorer; explain that the agent keeps polling |
| Venue Wi-Fi down | — | Phone hotspot for the laptop; the phone is already on mobile data |

---

## After the demo

- Write down judge questions that are not in `PITCH.md`
- Upload the *unlisted* video + explorer link to the Devfolio submission if it is not there yet
- Share the repo link in the event's Telegram
