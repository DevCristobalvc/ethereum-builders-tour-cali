import type { Address, Hex } from "viem";

export type PairState = {
  id: string;
  status: "pending" | "approved" | "rejected";
  agentAddress: Address;
  agentName: string;
  agentPublicKey?: Hex; // recovered from the pairing signature
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
  /** secp256k1 public keys (recovered from signatures) — needed to seal secrets. */
  agentPublicKey?: Hex;
  ownerPublicKey?: Hex;
};

export type TransferAction = {
  type: "transfer";
  token: Address;
  to: Address;
  amount: string; // human units, e.g. "10"
  memo?: string;
};

/** Agent asks to read a sealed secret (signed as EIP-712 RevealRequest). */
export type RevealAction = {
  type: "reveal";
  name: string;
  reason: string;
  nonce: string;
  expiry: string; // unix seconds
};

/** Sealer (agent-side CLI) asks the owner to activate a sealed secret (EIP-712 SealRequest). */
export type SealAction = {
  type: "seal";
  name: string;
  blobHash: Hex;
  maxReads: string;
  expiry: string; // unix seconds — also the on-chain visa expiry
  nonce: string;
};

export type Action = TransferAction | RevealAction | SealAction;

export type SecretRecord = {
  name: string;
  agentAddress: Address;
  ownerAddress: Address;
  agentId: string;
  /** ECIES(owner, {inner: ECIES(agent, secret)}) — ciphertext only, see pap-core.ts */
  blob: string;
  blobHash: Hex;
  maxReads: string;
  expiry: string; // unix seconds
  status: "pending" | "active" | "revoked";
  createdAt: number;
  sealRequestId?: string;
  /** true on the copy parked under `pending.<requestId>` until the phone approves the seal */
  staging?: boolean;
  grantTx?: Hex;
  activatedAt?: number;
  revokedAt?: number;
  lastReadAt?: number;
  reads: number;
};

export type SecretMeta = Omit<SecretRecord, "blob">;

export type RequestState = {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  agentAddress: Address;
  agentName: string;
  agentId: string;
  ownerAddress: Address;
  action: Action;
  createdAt: number;
  expiresAt: number;
  txHash?: Hex;
  reason?: string;
  resolvedAt?: number;
  /** reveal: the inner blob (still encrypted to the agent) + the owner's EIP-712 RevealApproval */
  result?: string;
  approvalSig?: Hex;
};
