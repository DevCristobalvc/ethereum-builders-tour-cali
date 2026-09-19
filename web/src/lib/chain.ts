import { concatHex, defineChain, keccak256, stringToHex, type Address } from "viem";
import abis from "@/generated/abis.json";
import deployments from "@/generated/deployments.json";

export const hskTestnet = defineChain({
  id: 133,
  name: "HSK Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet.hsk.xyz"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://testnet-explorer.hskchain.net" } },
  testnet: true,
});

export const EXPLORER = hskTestnet.blockExplorers.default.url;
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (addr: string) => `${EXPLORER}/address/${addr}`;

type Deployed = Partial<Record<"IdentityRegistry" | "AgentPassport" | "DemoUSDT" | "ReputationRegistry" | "PassportRegistry" | "Groth16Verifier" | "issuer", Address>>;
export const ADDRESSES: Deployed = (deployments as Record<string, Deployed>)["133"] ?? {};

export const ABI = abis as Record<keyof typeof abis, readonly unknown[]>;

export const DEMO_TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "demoUSDT";

/** AgentPassport scope for ERC-20 transfers of a token = keccak256(abi.encodePacked("transfer:", token)). */
export const transferScope = (token: Address) => keccak256(concatHex([stringToHex("transfer:"), token]));
