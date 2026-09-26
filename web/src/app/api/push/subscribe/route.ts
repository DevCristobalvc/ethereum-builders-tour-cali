import { isAddress, type Hex } from "viem";
import { bad, json } from "@/lib/api";
import { addSubscription, pushEnabled } from "@/lib/push";
import { verifySig } from "@/lib/sig";
export const dynamic = "force-dynamic";

/** Phone → relay: register a Web Push subscription. Body: { owner, subscription, sig } — sig = canonical("push-subscribe", {owner, endpoint}). */
export async function POST(req: Request) {
  if (!pushEnabled()) return bad("push notifications are not configured on this relay", 501);
  const b = await req.json().catch(() => null);
  const sub = b?.subscription;
  if (!b || !isAddress(b.owner) || typeof b.sig !== "string" || typeof sub?.endpoint !== "string" || !sub?.keys?.p256dh || !sub?.keys?.auth)
    return bad("owner, subscription {endpoint, keys}, sig required");
  if (!/^https?:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000) return bad("bad endpoint");
  if (!(await verifySig("push-subscribe", { owner: b.owner, endpoint: sub.endpoint }, b.owner, b.sig as Hex))) return bad("bad signature", 401);
  const devices = await addSubscription(b.owner, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return json({ ok: true, devices });
}

/** Whether this relay can send push (so the phone knows whether to offer it). */
export async function GET() {
  return json({ enabled: pushEnabled(), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null });
}
