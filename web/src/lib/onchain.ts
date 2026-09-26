"use client";
/** Phone-side on-chain actions on HSK Chain testnet, signed with the passkey-gated key. */
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  maxUint256,
  parseAbiItem,
  parseEventLogs,
  parseUnits,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ABI, ADDRESSES, DEMO_TOKEN_DECIMALS, hskTestnet, transferScope } from "./chain";
import { revealRef, secretScope } from "./pap-core";

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

export type Grant = { limit: bigint; spent: bigint; expiry: bigint; active: boolean };
export async function readGrant(agentId: bigint, token: Address): Promise<Grant> {
  const passport = need("AgentPassport");
  const [limit, spent, expiry, active] = (await pub.readContract({
    address: passport,
    abi: ABI.AgentPassport,
    functionName: "getGrant",
    args: [agentId, transferScope(token)],
  })) as [bigint, bigint, bigint, boolean];
  return { limit, spent, expiry, active };
}

/** AgentPassport deploy block on HSK testnet — start of the stamp history. */
const PASSPORT_DEPLOY_BLOCK = 33334362n;
export type Stamp = { txHash: Hex; token: Address; to: Address; amount: bigint; by: Address; block: bigint };

/** Every payment this agent's passport has been stamped with (Paid events). */
export async function readStamps(agentId: bigint): Promise<Stamp[]> {
  const passport = need("AgentPassport");
  const logs = await pub.getLogs({
    address: passport,
    event: parseAbiItem(
      "event Paid(uint256 indexed agentId, address indexed token, address indexed to, uint256 amount, bytes32 ref, address by)"
    ),
    args: { agentId },
    fromBlock: PASSPORT_DEPLOY_BLOCK,
    toBlock: "latest",
  });
  return logs
    .map((l) => ({ txHash: l.transactionHash, token: l.args.token!, to: l.args.to!, amount: l.args.amount!, by: l.args.by!, block: l.blockNumber }))
    .reverse();
}

export async function tokenBalance(owner: Address) {
  const token = need("DemoUSDT");
  return (await pub.readContract({ address: token, abi: ABI.DemoUSDT, functionName: "balanceOf", args: [owner] })) as bigint;
}

export const gasBalance = (a: Address) => pub.getBalance({ address: a });

/** Sealed secrets: the visa for scope keccak256("secret:" + name) — `maxReads` reads until `expiry`. */
export async function grantSecretVisa(pk: Hex, agentId: bigint, name: string, maxReads: bigint, expiry: bigint) {
  const { client } = walletFor(pk);
  const hash = await client.writeContract({
    address: need("AgentPassport"),
    abi: ABI.AgentPassport,
    functionName: "grant",
    args: [agentId, secretScope(name), maxReads, expiry],
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error("grant reverted");
  return hash;
}

/** One read of a sealed secret = one `record()` stamp; reverts LimitExceeded / Expired on-chain. */
export async function recordReveal(pk: Hex, agentId: bigint, name: string, requestId: string) {
  const { client } = walletFor(pk);
  const hash = await client.writeContract({
    address: need("AgentPassport"),
    abi: ABI.AgentPassport,
    functionName: "record",
    args: [agentId, secretScope(name), 1n, revealRef(requestId)],
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error("record reverted (read limit reached or visa expired)");
  return hash;
}

export async function readSecretGrant(agentId: bigint, name: string): Promise<Grant> {
  const [limit, spent, expiry, active] = (await pub.readContract({
    address: need("AgentPassport"),
    abi: ABI.AgentPassport,
    functionName: "getGrant",
    args: [agentId, secretScope(name)],
  })) as [bigint, bigint, bigint, boolean];
  return { limit, spent, expiry, active };
}

export async function revokeVisa(pk: Hex, agentId: bigint, scope: Hex) {
  const { client } = walletFor(pk);
  const hash = await client.writeContract({ address: need("AgentPassport"), abi: ABI.AgentPassport, functionName: "revoke", args: [agentId, scope] });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error("revoke reverted");
  return hash;
}
