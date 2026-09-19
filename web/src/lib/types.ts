import type { Address, Hex } from "viem";

export type PairState = {
  id: string;
  status: "pending" | "approved" | "rejected";
  agentAddress: Address;
  agentName: string;
  createdAt: number;
  ownerAddress?: Address;
  agentId?: string; // uint256 as string
  txHash?: Hex;
  resolvedAt?: number;
};

export type AgentRecord = {
  agentAddress: Address;
  agentName: string;
  ownerAddress: Address;
  agentId: string;
  pairedAt: number;
};

export type TransferAction = {
  type: "transfer";
  token: Address;
  to: Address;
  amount: string; // human units, e.g. "10"
  memo?: string;
};

export type RequestState = {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  agentAddress: Address;
  agentName: string;
  agentId: string;
  ownerAddress: Address;
  action: TransferAction;
  createdAt: number;
  expiresAt: number;
  txHash?: Hex;
  reason?: string;
  resolvedAt?: number;
};
