import { bad, json, baseUrl } from "@/lib/api";
import { ADDRESSES } from "@/lib/chain";
import { read } from "@/lib/store";
import type { AgentRecord } from "@/lib/types";
export const dynamic = "force-dynamic";

/** ERC-8004 "registration file" served as the agentURI. */
export async function GET(_: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const rec = await read<AgentRecord>("agent", address.toLowerCase());
  return json({
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: rec?.agentName ?? `PAP agent ${address.slice(0, 8)}`,
    description: "AI agent whose actions are authorised by its human owner via passkey (Passport Agent Protocol).",
    image: `${baseUrl()}/icon-512.png`,
    services: [{ name: "MCP", endpoint: "stdio://pap", version: "2025-06" }],
    x402Support: false,
    supportedTrust: ["human-passkey-approval", "agent-passport-visa"],
    registrations: rec
      ? [{ agentId: Number(rec.agentId), agentRegistry: `eip155:133:${ADDRESSES.IdentityRegistry ?? ""}` }]
      : [],
    pap: { agentAddress: address, owner: rec?.ownerAddress ?? null, passport: ADDRESSES.AgentPassport ?? null },
  });
}
