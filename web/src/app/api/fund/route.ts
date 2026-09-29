import { createPublicClient, createWalletClient, http, isAddress, parseEther, type Address } from "viem";
import { nonceManager, privateKeyToAccount } from "viem/accounts";
import { bad, json } from "@/lib/api";
import { hskTestnet } from "@/lib/chain";
import { read, write } from "@/lib/store";
export const dynamic = "force-dynamic";

const GAS_GRANT = parseEther("0.002");
// Anyone can mint fresh addresses, so a signature proves nothing here; limits are what keep the funder alive.
const PER_IP_PER_DAY = 3;
const GLOBAL_PER_HOUR = 30;

type Counter = { n: number };

/** Best-effort counter on the relay store (not atomic; enough to stop a drain loop). */
async function bump(id: string, max: number): Promise<boolean> {
  const c = (await read<Counter>("fund", id))?.n ?? 0;
  if (c >= max) return false;
  await write("fund", id, { n: c + 1 });
  return true;
}

/** Testnet gas sponsor: sends a little HSK to a fresh phone wallet so onboarding needs no faucet. */
export async function POST(req: Request) {
  const pk = process.env.FUNDER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) return bad("funder not configured", 503);
  const { address } = await req.json().catch(() => ({}));
  if (!isAddress(address)) return bad("address required");
  const addr = (address as string).toLowerCase();

  if (await read("fund", `addr.${addr}`)) return json({ funded: false, reason: "already funded once" });

  const pub = createPublicClient({ chain: hskTestnet, transport: http() });
  const bal = await pub.getBalance({ address: address as Address });
  if (bal >= GAS_GRANT / 2n) return json({ funded: false, reason: "already has gas", balance: bal.toString() });

  const now = new Date();
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().replace(/[^0-9a-fA-F:.]/g, "") || "unknown";
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  if (!(await bump(`ip.${ip}.${day}`, PER_IP_PER_DAY))) return bad("gas sponsor limit reached for today, use the HSK faucet", 429);
  if (!(await bump(`all.${hour}`, GLOBAL_PER_HOUR))) return bad("gas sponsor is busy, try again later or use the HSK faucet", 429);
  // Local nonces: concurrent grants must not reuse the funder's nonce.
  const wallet = createWalletClient({ account: privateKeyToAccount(pk, { nonceManager }), chain: hskTestnet, transport: http() });
  try {
    const hash = await wallet.sendTransaction({ to: address as Address, value: GAS_GRANT });
    await pub.waitForTransactionReceipt({ hash });
    await write("fund", `addr.${addr}`, { at: now.toISOString(), txHash: hash });
    return json({ funded: true, txHash: hash });
  } catch (e) {
    return bad(`gas sponsor failed: ${(e as Error).message.split("\n")[0]}`, 502);
  }
}
