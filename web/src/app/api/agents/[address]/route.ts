import { bad, json } from "@/lib/api";
import { read } from "@/lib/store";
import type { AgentRecord } from "@/lib/types";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const rec = await read<AgentRecord>("agent", address.toLowerCase());
  return rec ? json(rec) : bad("not paired", 404);
}
