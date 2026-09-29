/**
 * Web Push to the owner's phone when an agent asks for something. Server only.
 * Enabled when NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY are set; otherwise a no-op
 * (the QR / link flow keeps working). Payloads carry no sensitive data: agent name + action type.
 */
import webpush, { type PushSubscription } from "web-push";
import { read, write } from "./store";
import type { Action } from "./types";

export type PushRecord = { owner: string; subs: PushSubscription[]; updatedAt: number };

const MAX_SUBS = 5;
const publicKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
export const pushEnabled = () => Boolean(publicKey() && process.env.VAPID_PRIVATE_KEY);

export async function addSubscription(owner: string, sub: PushSubscription) {
  const id = owner.toLowerCase();
  const cur = (await read<PushRecord>("push", id))?.subs ?? [];
  const subs = [sub, ...cur.filter((s) => s.endpoint !== sub.endpoint)].slice(0, MAX_SUBS);
  await write<PushRecord>("push", id, { owner: id, subs, updatedAt: Date.now() });
  return subs.length;
}

const VERB: Record<Action["type"], string> = {
  transfer: "wants to make a payment",
  reveal: "wants to read a secret",
  seal: "wants you to store a secret",
};

/** Notify every device of `owner`; drops subscriptions the push service says are gone. */
export async function notifyOwner(owner: string, agentName: string, action: Action, url: string) {
  if (!pushEnabled()) return { sent: 0, skipped: "push not configured" };
  const id = owner.toLowerCase();
  const rec = await read<PushRecord>("push", id);
  if (!rec?.subs.length) return { sent: 0 };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:pap@devcristobalvc.com", publicKey()!, process.env.VAPID_PRIVATE_KEY!);
  const payload = JSON.stringify({ title: "PAP · approval needed", body: `${agentName} ${VERB[action.type]}`, url, tag: url });
  const alive: PushSubscription[] = [];
  let sent = 0;
  await Promise.all(
    rec.subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, payload, { TTL: 600, urgency: "high" });
        sent++;
        alive.push(s);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code !== 404 && code !== 410) alive.push(s); // keep on transient errors
      }
    })
  );
  if (alive.length !== rec.subs.length) await write<PushRecord>("push", id, { ...rec, subs: alive, updatedAt: Date.now() });
  return { sent };
}
