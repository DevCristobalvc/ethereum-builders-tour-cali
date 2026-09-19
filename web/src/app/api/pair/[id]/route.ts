import { bad, json } from "@/lib/api";
import { read } from "@/lib/store";
import type { PairState } from "@/lib/types";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await read<PairState>("pair", id);
  return state ? json(state) : bad("not found", 404);
}
