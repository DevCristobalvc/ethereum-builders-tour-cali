#!/usr/bin/env node
/**
 * Passport Agent Protocol — MCP server.
 * Gives any MCP client (Claude Code, Cursor, Claude Desktop…) a way to ask its
 * human for permission. The agent never holds funds or secrets: it signs a
 * request, the human approves on their phone with a passkey, the phone executes
 * on HSK Chain, and the agent gets the result.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isAddress, type Address } from "viem";
import { z } from "zod";
import { addresses, ownerBalance, visa } from "./chain.js";
import { createIdentity, identityPath, loadIdentity, saveIdentity, type Identity } from "./identity.js";
import { call, explorerTx, openBrowser, sign, waitFor, type PairState, type RequestState } from "./relay.js";

const WAIT_MS = Number(process.env.PAP_WAIT_MS ?? 90_000);

const server = new McpServer({ name: "pap", version: "0.1.0" });
const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

function requireIdentity(): Identity {
  const id = loadIdentity();
  if (!id) throw new Error("No agent identity yet. Call pap_connect first.");
  return id;
}

server.registerTool(
  "pap_status",
  {
    title: "Passport status",
    description:
      "Show this agent's passport: identity, whether it is connected to a human owner, the on-chain visa (spending limit / remaining / expiry) and the owner's demoUSDT balance. Call this first when the user asks about payments, permissions or the agent's wallet.",
    inputSchema: {},
  },
  async () => {
    const id = loadIdentity();
    if (!id) return text(`Not connected. No identity at ${identityPath()}. Call pap_connect to pair with the human's phone.`);
    const [v, bal, a] = await Promise.all([visa(id), ownerBalance(id), addresses(id)]);
    return text(
      [
        `Agent: ${id.name} (${id.address})`,
        id.ownerAddress ? `Owner: ${id.ownerAddress} · ERC-8004 agentId #${id.agentId}` : "Owner: NOT PAIRED — call pap_connect",
        v
          ? `Visa (demoUSDT transfers): ${v.active ? "active" : "INACTIVE"} · limit ${v.limit} · spent ${v.spent} · remaining ${v.remaining} · expires ${v.expires}`
          : "Visa: none",
        bal !== null ? `Owner demoUSDT balance: ${bal}` : "",
        `Contacts: ${Object.keys(id.contacts).length ? Object.entries(id.contacts).map(([n, a]) => `${n}=${a}`).join(", ") : "none"}`,
        `Relay: ${id.relay} · Passport: ${a.AgentPassport ?? "?"} · Chain: HSK testnet (133)`,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
);

server.registerTool(
  "pap_connect",
  {
    title: "Connect agent to human (pairing)",
    description:
      "Pair this agent with its human owner. Creates the agent identity if needed, opens a QR on screen, and waits while the human scans it on their phone, creates/uses their passkey wallet and registers the agent on HSK Chain (ERC-8004) with a spending visa. Use when pap_status says NOT PAIRED, or when the user asks to connect/onboard the agent.",
    inputSchema: {
      name: z.string().optional().describe("Human-readable agent name shown on the phone, e.g. 'Claude Code @ Cristobal laptop'"),
    },
  },
  async ({ name }) => {
    let id = loadIdentity() ?? createIdentity(name ?? "Claude Code agent");
    if (name && name !== id.name) {
      id.name = name;
      saveIdentity(id);
    }
    if (id.ownerAddress) return text(`Already paired with ${id.ownerAddress} (agentId #${id.agentId}). Use pap_status.`);

    const payload = { agentAddress: id.address, agentName: id.name };
    const { pairId, url, showUrl } = await call<{ pairId: string; url: string; showUrl: string }>(id, "/api/pair", {
      method: "POST",
      body: JSON.stringify({ ...payload, sig: await sign(id, "pair", payload) }),
    });
    openBrowser(showUrl);

    const state = await waitFor<PairState>(id, `/api/pair/${pairId}`, WAIT_MS);
    if (state?.status === "approved") {
      id = { ...id, ownerAddress: state.ownerAddress, agentId: state.agentId, pairedAt: Date.now() };
      saveIdentity(id);
      const v = await visa(id);
      return text(
        `Paired. Owner ${state.ownerAddress} registered this agent as ERC-8004 agent #${state.agentId} on HSK Chain` +
          (state.txHash ? ` (${explorerTx(state.txHash)})` : "") +
          (v ? `.\nVisa: up to ${v.limit} demoUSDT until ${v.expires}.` : ".")
      );
    }
    if (state?.status === "rejected") return text("The human rejected the pairing.");
    return text(`Still waiting for the phone. QR: ${showUrl}\nPhone link: ${url}\nCall pap_wait with kind="pair" id="${pairId}" to keep waiting.`);
  }
);

server.registerTool(
  "pap_transfer",
  {
    title: "Request a demoUSDT transfer (needs human approval)",
    description:
      "Ask the human owner to send demoUSDT on HSK Chain to an address or a saved contact name. This tool does NOT move funds itself: it shows a QR, the human reviews and approves with Face ID on their phone, the phone executes AgentPassport.pay() (visa limit enforced on-chain), and the tx hash comes back here. Blocks up to ~90s; if still pending, call pap_wait.",
    inputSchema: {
      to: z.string().describe("Recipient: 0x address or a contact name (see pap_status)"),
      amount: z.string().describe("Amount in demoUSDT, e.g. '10' or '2.5'"),
      memo: z.string().optional().describe("Short reason shown to the human, e.g. 'Pay Maria for the dataset'"),
    },
  },
  async ({ to, amount, memo }) => {
    const id = requireIdentity();
    if (!id.ownerAddress) throw new Error("Not paired. Call pap_connect first.");
    const a = await addresses(id);
    if (!a.DemoUSDT) throw new Error("demoUSDT not deployed on the relay's chain");
    const dest = isAddress(to) ? (to as Address) : id.contacts[to.toLowerCase()];
    if (!dest) throw new Error(`Unknown recipient '${to}'. Give a 0x address or save a contact with pap_contact_add.`);
    if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error("amount must be a decimal string like '10'");

    const payload = { agentAddress: id.address, action: { type: "transfer", token: a.DemoUSDT, to: dest, amount, memo: memo ?? "" } };
    const { requestId, url, showUrl } = await call<{ requestId: string; url: string; showUrl: string }>(id, "/api/requests", {
      method: "POST",
      body: JSON.stringify({ ...payload, sig: await sign(id, "request", payload) }),
    });
    openBrowser(showUrl);
    const st = await waitFor<RequestState>(id, `/api/requests/${requestId}`, WAIT_MS);
    return text(describe(st, requestId, url, showUrl));
  }
);

server.registerTool(
  "pap_wait",
  {
    title: "Keep waiting for a pending approval",
    description: "Continue waiting for a pairing or transfer request that was still pending. Returns as soon as the human resolves it (or after ~90s).",
    inputSchema: {
      kind: z.enum(["pair", "request"]),
      id: z.string(),
    },
  },
  async ({ kind, id: rid }) => {
    let id = requireIdentity();
    if (kind === "pair") {
      const st = await waitFor<PairState>(id, `/api/pair/${rid}`, WAIT_MS);
      if (st?.status === "approved") {
        id = { ...id, ownerAddress: st.ownerAddress, agentId: st.agentId, pairedAt: Date.now() };
        saveIdentity(id);
        return text(`Paired. Owner ${st.ownerAddress}, ERC-8004 agent #${st.agentId}.`);
      }
      return text(st?.status === "rejected" ? "Pairing rejected." : "Still pending.");
    }
    const st = await waitFor<RequestState>(id, `/api/requests/${rid}`, WAIT_MS);
    return text(describe(st, rid, `${id.relay}/approve/${rid}`, `${id.relay}/show/request/${rid}`));
  }
);

server.registerTool(
  "pap_contact_add",
  {
    title: "Save a contact",
    description: "Save a name → address mapping so the user can say 'send 10 to maria'.",
    inputSchema: { name: z.string(), address: z.string() },
  },
  async ({ name, address }) => {
    if (!isAddress(address)) throw new Error("invalid address");
    const id = loadIdentity() ?? createIdentity("Claude Code agent");
    id.contacts[name.toLowerCase()] = address as Address;
    saveIdentity(id);
    return text(`Saved ${name} = ${address}`);
  }
);

function describe(st: RequestState | undefined, requestId: string, url: string, showUrl: string) {
  if (!st) return `Could not reach the relay. Request ${requestId} at ${url}`;
  switch (st.status) {
    case "approved":
      return `APPROVED by the human. ${st.action.amount} demoUSDT sent to ${st.action.to} via AgentPassport.pay on HSK Chain.\nTx: ${st.txHash}\nExplorer: ${explorerTx(st.txHash!)}`;
    case "rejected":
      return `REJECTED by the human${st.reason ? ` (${st.reason})` : ""}. Do not retry without asking the user.`;
    case "expired":
      return "Request expired (10 min) without a decision.";
    default:
      return `Still waiting for the human. QR on screen: ${showUrl}\nPhone link: ${url}\nCall pap_wait with kind="request" id="${requestId}".`;
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
