"use client";
/** Phone-side on-chain actions on HSK Chain testnet, signed with the passkey-gated key. */
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  maxUint256,
  parseEventLogs,
  parseUnits,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ABI, ADDRESSES, DEMO_TOKEN_DECIMALS, hskTestnet, transferScope } from "./chain";

export const pub = createPublicClient({ chain: hskTestnet, transport: http() });

export function walletFor(pk: Hex) {
  const account = privateKeyToAccount(pk);
  return { account, client: createWalletClient({ account, chain: hskTestnet, transport: http() }) };
}

function need(name: keyof typeof ADDRESSES): Address {
  const a = ADDRESSES[name];
  if (!a) throw new Error(`${name} not deployed yet`);
  return a;
}

export type Step = { label: string; hash?: Hex; done?: boolean; error?: string };

/**
 * Onboarding for a new agent, run by the human wallet:
 *  1. ERC-8004 register(agentURI, agentWallet)  → agentId
 *  2. demoUSDT.faucet()                         → 1000 demoUSDT to play with
 *  3. demoUSDT.approve(AgentPassport, max)
 *  4. AgentPassport.grant(agentId, transfer scope, limit, expiry)
 */
export async function onboardAgent(
  pk: Hex,
  agentAddress: Address,
  agentURI: string,
  limitHuman: string,
  days: number,
  onStep: (s: Step[]) => void
): Promise<{ agentId: bigint; steps: Step[] }> {
  const { client } = walletFor(pk);
  const identity = need("IdentityRegistry");
  const passport = need("AgentPassport");
  const token = need("DemoUSDT");
  const steps: Step[] = [
    { label: "Register agent (ERC-8004)" },
    { label: "Claim demoUSDT from faucet" },
    { label: "Allow passport to move demoUSDT" },
    { label: `Grant visa: up to ${limitHuman} demoUSDT for ${days}d` },
  ];
  const report = () => onStep([...steps]);
  const run = async (i: number, fn: () => Promise<Hex>) => {
    report();
    const hash = await fn();
    steps[i].hash = hash;
    report();
    const rc = await pub.waitForTransactionReceipt({ hash });
    if (rc.status !== "success") throw new Error(`${steps[i].label} reverted`);
    steps[i].done = true;
    report();
    return rc;
  };

  const regRc = await run(0, () =>
    client.writeContract({ address: identity, abi: ABI.IdentityRegistry, functionName: "register", args: [agentURI, agentAddress] })
  );
  // Take the id from the Registered event: an eth_call right after the receipt can hit a lagging RPC node.
  const [reg] = parseEventLogs({ abi: ABI.IdentityRegistry as never, eventName: "Registered", logs: regRc.logs });
  const agentId = (reg as unknown as { args: { agentId: bigint } }).args.agentId;

  await run(1, () => client.writeContract({ address: token, abi: ABI.DemoUSDT, functionName: "faucet", args: [] }));
  await run(2, () => client.writeContract({ address: token, abi: ABI.DemoUSDT, functionName: "approve", args: [passport, maxUint256] }));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + days * 86400);
  await run(3, () =>
    client.writeContract({
      address: passport,
      abi: ABI.AgentPassport,
      functionName: "grant",
      args: [agentId, transferScope(token), parseUnits(limitHuman, DEMO_TOKEN_DECIMALS), expiry],
    })
  );
  return { agentId, steps };
}

/** Approved transfer: one tx through the passport (enforces the visa on-chain). */
export async function payViaPassport(pk: Hex, agentId: bigint, token: Address, to: Address, amountHuman: string, requestId: string) {
  const { client } = walletFor(pk);
  const passport = need("AgentPassport");
  const ref = keccak256(toBytes(`pap:req:${requestId}`));
  const hash = await client.writeContract({
    address: passport,
    abi: ABI.AgentPassport,
    functionName: "pay",
    args: [agentId, token, to, parseUnits(amountHuman, DEMO_TOKEN_DECIMALS), ref],
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error("pay reverted");
  return hash;
}

export async function readGrant(agentId: bigint, token: Address) {
  const passport = need("AgentPassport");
  const r = (await pub.readContract({
    address: passport,
    abi: ABI.AgentPassport,
    functionName: "getGrant",
    args: [agentId, transferScope(token)],
  })) as readonly unknown[] | Record<string, unknown>;
  return r;
}

export async function tokenBalance(owner: Address) {
  const token = need("DemoUSDT");
  return (await pub.readContract({ address: token, abi: ABI.DemoUSDT, functionName: "balanceOf", args: [owner] })) as bigint;
}

export const gasBalance = (a: Address) => pub.getBalance({ address: a });
