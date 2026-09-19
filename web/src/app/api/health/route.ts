import { json } from "@/lib/api";
import { ADDRESSES } from "@/lib/chain";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    ok: true,
    chainId: 133,
    addresses: ADDRESSES,
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    funder: Boolean(process.env.FUNDER_PRIVATE_KEY),
  });
}
