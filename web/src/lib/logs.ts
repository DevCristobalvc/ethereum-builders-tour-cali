/**
 * Event history for the passport. HSK's public RPC caps eth_getLogs at a few thousand blocks,
 * so history comes from the explorer's Etherscan-style API (Blockscout, CORS open, any range).
 * If the explorer is down we fall back to the RPC over the most recent blocks only.
 */
import { decodeEventLog, encodeEventTopics, type AbiEvent, type Address, type Hex } from "viem";
import { EXPLORER } from "./chain";
import { pub } from "./onchain";

/** AgentPassport deploy block on HSK testnet — start of the stamp history. */
export const PASSPORT_DEPLOY_BLOCK = 33334362n;
const RPC_FALLBACK_BLOCKS = 4000n;

export type DecodedLog<T> = { args: T; txHash: Hex; block: bigint };

type ExplorerLog = { topics: (Hex | null)[]; data: Hex; blockNumber: Hex; transactionHash: Hex };

/**
 * Logs of `event` emitted by `address`, filtered on the first indexed argument when given.
 * Returned oldest first.
 */
export async function eventLogs<T>(address: Address, event: AbiEvent, firstIndexed?: bigint): Promise<DecodedLog<T>[]> {
  const topics = encodeEventTopics({ abi: [event], eventName: event.name, args: firstIndexed === undefined ? undefined : [firstIndexed] } as never) as Hex[];
  const decode = (l: { topics: Hex[]; data: Hex }) =>
    decodeEventLog({ abi: [event], topics: l.topics as [Hex, ...Hex[]], data: l.data }).args as unknown as T;

  try {
    const q = new URLSearchParams({ module: "logs", action: "getLogs", fromBlock: PASSPORT_DEPLOY_BLOCK.toString(), toBlock: "latest", address, topic0: topics[0] });
    if (topics[1]) {
      q.set("topic1", topics[1]);
      q.set("topic0_1_opr", "and");
    }
    const r = await fetch(`${EXPLORER}/api?${q}`, { cache: "no-store" });
    const body = (await r.json()) as { status?: string; message?: string; result?: ExplorerLog[] | string };
    if (!Array.isArray(body.result)) {
      // Etherscan-style "No records found" is an empty history, not a failure.
      if (/no (records|logs) found/i.test(body.message ?? "")) return [];
      throw new Error(body.message ?? "explorer error");
    }
    return body.result.map((l) => ({
      args: decode({ topics: l.topics.filter((t): t is Hex => !!t), data: l.data }),
      txHash: l.transactionHash,
      block: BigInt(l.blockNumber),
    }));
  } catch {
    const latest = await pub.getBlockNumber();
    const from = latest > RPC_FALLBACK_BLOCKS ? latest - RPC_FALLBACK_BLOCKS : 0n;
    const key = event.inputs.find((i) => i.indexed)?.name;
    const logs = await pub.getLogs({
      address,
      event,
      args: firstIndexed === undefined || !key ? undefined : { [key]: firstIndexed },
      fromBlock: from > PASSPORT_DEPLOY_BLOCK ? from : PASSPORT_DEPLOY_BLOCK,
      toBlock: latest,
    } as never);
    return logs.map((l) => ({ args: decode({ topics: l.topics as Hex[], data: l.data }), txHash: l.transactionHash, block: l.blockNumber }));
  }
}
