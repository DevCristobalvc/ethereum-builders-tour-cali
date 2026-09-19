import { createPublicClient, createWalletClient, http, isAddress, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bad, json } from "@/lib/api";
import { hskTestnet } from "@/lib/chain";
export const dynamic = "force-dynamic";

const GAS_GRANT = parseEther("0.002");

/** Testnet gas sponsor: sends a little HSK to a fresh phone wallet so onboarding needs no faucet. */
export async function POST(req: Request) {
  const pk = process.env.FUNDER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) return bad("funder not configured", 503);
  const { address } = await req.json().catch(() => ({}));
  if (!isAddress(address)) return bad("address required");

  const pub = createPublicClient({ chain: hskTestnet, transport: http() });
  const bal = await pub.getBalance({ address: address as Address });
  if (bal >= GAS_GRANT / 2n) return json({ funded: false, reason: "already has gas", balance: bal.toString() });

  const wallet = createWalletClient({ account: privateKeyToAccount(pk), chain: hskTestnet, transport: http() });
  const hash = await wallet.sendTransaction({ to: address as Address, value: GAS_GRANT });
  await pub.waitForTransactionReceipt({ hash });
  return json({ funded: true, txHash: hash });
}
