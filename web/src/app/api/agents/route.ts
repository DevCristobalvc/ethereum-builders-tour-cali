import { bad, json } from "@/lib/api";
import { readAll } from "@/lib/store";
import type { AgentRecord } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Phone → relay: agents paired to an owner. ?owner=0x.. */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner")?.toLowerCase();
  if (!owner) return bad("owner required");
  const all = await readAll<AgentRecord>("agent", 200);
  return json(all.filter((a) => a.ownerAddress.toLowerCase() === owner));
}
