import { bad, json } from "@/lib/api";
import { read, write } from "@/lib/store";
import type { RequestState } from "@/lib/types";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await read<RequestState>("request", id);
  if (!state) return bad("not found", 404);
  if (state.status === "pending" && Date.now() > state.expiresAt) {
    const expired: RequestState = { ...state, status: "expired", resolvedAt: Date.now() };
    await write("request", id, expired);
    return json(expired);
  }
  return json(state);
}
