#!/usr/bin/env node
/**
 * Passport Agent Protocol — MCP server.
 * Gives any MCP client (Claude Code, Cursor, Claude Desktop…) a way to ask its
 * human for permission. The agent never holds funds, and gets a secret only when
 * the human releases it: it signs a request, the human approves on their phone with
 * a passkey, the phone executes on HSK Chain, and the agent gets the result.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isAddress, type Address } from "viem";
import { z } from "zod";
import { addresses, ownerBalance, visa } from "./chain.js";
import { createIdentity, identityPath, loadIdentity, saveIdentity, type Identity } from "./identity.js";
import { call, explorerTx, openBrowser, sign, waitFor, type PairState, type RequestState } from "./relay.js";
import { awaitReveal, ExpiredError, listSecrets, RejectedError, requestReveal, writeSecretFile } from "./secrets.js";

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
    description:
      "Continue waiting for a pairing, transfer or secret request that was still pending. Returns as soon as the human resolves it (or after ~90s). For kind='secret' also pass name (and deliver, as in pap_secret).",
    inputSchema: {
      kind: z.enum(["pair", "request", "secret"]),
      id: z.string(),
      name: z.string().optional().describe("Secret name (kind='secret' only)"),
      deliver: z.enum(["file", "inline"]).optional(),
    },
  },
  async ({ kind, id: rid, name, deliver }) => {
    let id = requireIdentity();
    if (kind === "secret") {
      if (!name) throw new Error("name is required for kind='secret'");
      return revealResult(id, rid, name, deliver ?? "file");
    }
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

server.registerTool(
  "pap_call_gate",
  {
    title: "Call a visa-gated service (x402-style)",
    description:
      "Access a paid/protected HTTP resource that requires a valid agent visa, without asking the human: GET → 402 challenge → sign it with the agent identity key → GET again with X-PAP-VISA → 200 data. The service checks on-chain (HSK Chain) that this key belongs to the ERC-8004 agent and that its AgentPassport visa is active. Default resource: the demo price oracle at <relay>/api/gate/oracle.",
    inputSchema: {
      url: z.string().optional().describe("Resource URL. Defaults to the relay's demo oracle."),
    },
  },
  async ({ url }) => {
    const id = requireIdentity();
    if (!id.agentId) throw new Error("Not paired. Call pap_connect first.");
    const target = url ?? `${id.relay}/api/gate/oracle`;

    const first = await fetch(target);
    if (first.status === 200) return text(`200 (no visa required)
${await first.text()}`);
    if (first.status !== 402) throw new Error(`unexpected ${first.status} from ${target}`);
    const offer = (await first.json()) as { accepts: { scheme: string; challenge: string; header?: string }[] };
    const accept = offer.accepts?.find((a) => a.scheme === "pap-visa");
    if (!accept) throw new Error("service does not accept pap-visa");

    const payload = { agentAddress: id.address, agentId: id.agentId, challenge: accept.challenge };
    const sig = await sign(id, "gate", payload);
    const token = Buffer.from(JSON.stringify({ ...payload, sig })).toString("base64");
    const res = await fetch(target, { headers: { [accept.header ?? "X-PAP-VISA"]: token } });
    const body = await res.text();
    if (res.status === 200) return text(`ACCESS GRANTED (visa verified on-chain, no human prompt).
${body}`);
    return text(`ACCESS DENIED ${res.status}: ${body}`);
  }
);


server.registerTool(
  "pap_secret",
  {
    title: "Read a sealed secret (needs human approval)",
    description: [
      "Get an API key, token or credential your human sealed for this agent (e.g. 'openai', 'stripe'). Nothing is released without their Face ID:",
      "you sign the request, they see your `reason` on their phone, approve, and only then the value is decrypted with your identity key.",
      "Rules: (1) give a concrete reason tied to the user's task — it is what the human reads; (2) NEVER print, log, echo, commit or write the value",
      "anywhere except the file this tool returns (default deliver='file' keeps it out of the conversation: read it from the file / use it via env);",
      "(3) if the human rejects, stop and tell the user — do not retry or look for the value elsewhere.",
      "Prefer pap_call_gate when a gated service exists (then you never need the raw key). See pap_secrets_list for available names.",
      "If the secret doesn't exist, ask the user to run `pap seal <name>` in THEIR terminal — never ask them to paste a secret into the chat.",
    ].join(" "),
    inputSchema: {
      name: z.string().describe("Secret name, e.g. 'openai' (lowercase a-z 0-9 _ -)"),
      reason: z.string().describe("Why you need it right now, in plain words, e.g. 'Run the integration tests that call the OpenAI API'"),
      deliver: z
        .enum(["file", "inline"])
        .optional()
        .describe("file (default): written to ~/.pap/secrets/<name> (0600), path returned. inline: value returned in the tool result."),
    },
  },
  async ({ name, reason, deliver }) => {
    const id = requireIdentity();
    const { requestId, url, showUrl } = await requestReveal(id, name, reason);
    openBrowser(showUrl);
    return revealResult(id, requestId, name, deliver ?? "file", url, showUrl);
  }
);

server.registerTool(
  "pap_secrets_list",
  {
    title: "List sealed secrets",
    description:
      "List the secrets your human sealed for this agent (names, status, reads used / allowed, expiry). Values are never shown. To add one, the human runs `pap seal <name>` in their own terminal.",
    inputSchema: {},
  },
  async () => {
    const id = requireIdentity();
    const list = await listSecrets(id);
    if (!list.length) return text("No sealed secrets yet. Your human can add one with: pap seal <name>   (in their terminal, not in this chat)");
    return text(
      list
        .map(
          (s) =>
            `${s.name}: ${s.status} · ${s.reads}/${s.maxReads} reads · expires ${new Date(Number(s.expiry) * 1000).toISOString()}` +
            (s.lastReadAt ? ` · last read ${new Date(s.lastReadAt).toISOString()}` : "")
        )
        .join("\n")
    );
  }
);

async function revealResult(id: Identity, requestId: string, name: string, deliver: "file" | "inline", url?: string, showUrl?: string) {
  try {
    const value = await awaitReveal(id, requestId, name, WAIT_MS);
    if (value === null)
      return text(
        `Waiting for your human to approve on their phone.${showUrl ? ` QR: ${showUrl}` : ""}${url ? `\nPhone link: ${url}` : ""}\n` +
          `Call pap_wait with kind="secret" id="${requestId}" name="${name}" to keep waiting.`
      );
    if (deliver === "inline")
      return text(`APPROVED. Secret "${name}" (do not print, log or commit it):\n${value}`);
    const file = writeSecretFile(name, value);
    return text(
      `APPROVED. Secret "${name}" written to ${file} (mode 0600). Do NOT print it. Use it without echoing, e.g.\n` +
        `  ${name.toUpperCase().replace(/-/g, "_")}_KEY="$(cat ${file})" your-command\nDelete the file when done: rm ${file}`
    );
  } catch (e) {
    if (e instanceof RejectedError || e instanceof ExpiredError) return text(`${(e as Error).message}`);
    throw e;
  }
}

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
