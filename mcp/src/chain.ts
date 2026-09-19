/** Read-only view of the agent's on-chain passport on HSK Chain testnet. */
import { concatHex, createPublicClient, defineChain, formatUnits, http, keccak256, stringToHex, type Address } from "viem";
import type { Identity } from "./identity.js";
import { call } from "./relay.js";

export const hskTestnet = defineChain({
  id: 133,
  name: "HSK Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: [process.env.PAP_RPC_URL ?? "https://testnet.hsk.xyz"] } },
});

const pub = createPublicClient({ chain: hskTestnet, transport: http() });

const passportAbi = [
  {
    type: "function",
    name: "getGrant",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "scope", type: "bytes32" },
    ],
    outputs: [
      { name: "limit", type: "uint256" },
      { name: "spent", type: "uint256" },
      { name: "expiry", type: "uint64" },
      { name: "active", type: "bool" },
    ],
  },
] as const;
const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export type Addresses = { AgentPassport?: Address; DemoUSDT?: Address; IdentityRegistry?: Address };
let cached: Addresses | undefined;
export async function addresses(id: Identity): Promise<Addresses> {
  if (cached) return cached;
  const h = await call<{ addresses: Addresses }>(id, "/api/health");
  cached = h.addresses;
  return cached;
}

/** = keccak256(abi.encodePacked("transfer:", token)) in AgentPassport */
export const transferScope = (token: Address) => keccak256(concatHex([stringToHex("transfer:"), token]));

export async function visa(id: Identity) {
  const a = await addresses(id);
  if (!a.AgentPassport || !a.DemoUSDT || !id.agentId) return null;
  try {
    const [limit, spent, expiry, active] = await pub.readContract({
      address: a.AgentPassport,
      abi: passportAbi,
      functionName: "getGrant",
      args: [BigInt(id.agentId), transferScope(a.DemoUSDT)],
    });
    return {
      limit: formatUnits(limit, 6),
      spent: formatUnits(spent, 6),
      remaining: formatUnits(limit - spent, 6),
      expires: new Date(Number(expiry) * 1000).toISOString(),
      active: active && Number(expiry) * 1000 > Date.now(),
    };
  } catch {
    return null;
  }
}

export async function ownerBalance(id: Identity) {
  const a = await addresses(id);
  if (!a.DemoUSDT || !id.ownerAddress) return null;
  const b = await pub.readContract({ address: a.DemoUSDT, abi: erc20Abi, functionName: "balanceOf", args: [id.ownerAddress] });
  return formatUnits(b, 6);
}
