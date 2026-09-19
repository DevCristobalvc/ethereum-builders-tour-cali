/**
 * PAP Gate — an x402-shaped border service.
 *
 * GET without credentials → 402 + `accepts[]` describing the required visa + a challenge.
 * GET with `X-PAP-VISA`   → agent signed the challenge; we check on-chain that the key is the
 *                           agent's identity key and that its visa is active → 200 with the data.
 *
 * Stateless: the challenge is `<hexTimestamp>.<hmac>` signed by the server, valid 5 minutes.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address, type Hex } from "viem";
import { ABI, ADDRESSES, hskTestnet, transferScope } from "@/lib/chain";
import { verifySig } from "@/lib/sig";

export const dynamic = "force-dynamic";

const SCHEME = "pap-visa";
const NETWORK = "eip155:133";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SECRET = process.env.GATE_SECRET ?? "dev";

const pub = createPublicClient({ chain: hskTestnet, transport: http() });

// ---- challenge (HMAC-signed timestamp, no store needed) ----

function mac(body: string) {
  return createHmac("sha256", SECRET).update(body).digest("hex").slice(0, 32);
}

function issueChallenge(): string {
  const body = `${Date.now().toString(16)}.${randomBytes(8).toString("hex")}`;
  return `${body}.${mac(body)}`;
}

function challengeAge(challenge: string): number | null {
  const parts = challenge.split(".");
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = mac(body);
  if (expected.length !== parts[2].length || !timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) {
    return null;
  }
  const ts = parseInt(parts[0], 16);
  return Number.isFinite(ts) ? Date.now() - ts : null;
}

// ---- responses ----

function paymentRequired(reason?: string) {
  const body = {
    ...(reason ? { error: reason } : {}),
    accepts: [
      {
        scheme: SCHEME,
        network: NETWORK,
        passport: ADDRESSES.AgentPassport,
        identity: ADDRESSES.IdentityRegistry,
        token: ADDRESSES.DemoUSDT,
        scope: "transfer",
        challenge: issueChallenge(),
        expiresIn: CHALLENGE_TTL_MS / 1000,
        header: "X-PAP-VISA",
        sign: "personal_sign(PAP:gate:<canonical JSON {agentAddress, agentId, challenge}>)",
      },
    ],
  };
  return NextResponse.json(body, { status: 402, headers: { "WWW-Authenticate": "PAP-Visa" } });
}

const forbidden = (reason: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error: reason, ...extra }, { status: 403 });

// ---- the protected resource ----

function oracleData() {
  // Deterministic-ish demo price so the demo looks alive.
  const t = Date.now();
  const value = Number((0.12 + 0.01 * Math.sin(t / 60_000)).toFixed(4));
  return { price: "HSK/USDT", value, ts: t };
}

type Visa = { agentAddress: Address; agentId: string; challenge: string; sig: Hex };

function parseVisa(header: string | null): Visa | null {
  if (!header) return null;
  try {
    const v = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    if (!isAddress(v.agentAddress) || typeof v.challenge !== "string" || typeof v.sig !== "string") return null;
    if (!/^\d+$/.test(String(v.agentId))) return null;
    return { agentAddress: v.agentAddress, agentId: String(v.agentId), challenge: v.challenge, sig: v.sig as Hex };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const visa = parseVisa(req.headers.get("x-pap-visa"));
  if (!visa) return paymentRequired();

  // 1. Challenge is ours and fresh.
  const age = challengeAge(visa.challenge);
  if (age === null) return forbidden("bad challenge");
  if (age > CHALLENGE_TTL_MS) return paymentRequired("challenge expired");

  // 2. Signature over the canonical payload by the claimed agent key.
  const { agentAddress, agentId, challenge, sig } = visa;
  if (!(await verifySig("gate", { agentAddress, agentId, challenge }, agentAddress, sig))) {
    return forbidden("bad signature");
  }

  // 3. On-chain: the key is the identity key of agentId (ERC-8004 IdentityRegistry).
  const { IdentityRegistry, AgentPassport, DemoUSDT } = ADDRESSES;
  if (!IdentityRegistry || !AgentPassport || !DemoUSDT) return forbidden("gate not configured");

  let wallet: Address;
  try {
    wallet = (await pub.readContract({
      address: IdentityRegistry,
      abi: ABI.IdentityRegistry,
      functionName: "getAgentWallet",
      args: [BigInt(agentId)],
    })) as Address;
  } catch {
    return forbidden("unknown agentId", { agentId });
  }
  if (wallet.toLowerCase() !== agentAddress.toLowerCase()) {
    return forbidden("key is not the agent's identity key", { agentId });
  }

  // 4. On-chain: the visa for this scope is active, not expired, not exhausted.
  const canAct = (await pub.readContract({
    address: AgentPassport,
    abi: ABI.AgentPassport,
    functionName: "canAct",
    args: [BigInt(agentId), transferScope(DemoUSDT), 0n],
  })) as boolean;
  if (!canAct) return forbidden("no valid visa (inactive, expired or exhausted)", { agentId });

  return NextResponse.json({ ok: true, data: oracleData(), agentId, scheme: SCHEME, network: NETWORK });
}
