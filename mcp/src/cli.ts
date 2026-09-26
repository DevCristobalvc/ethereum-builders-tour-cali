#!/usr/bin/env node
/**
 * pap — command line for the Passport Agent Protocol (same identity as the MCP server, ~/.pap/agent.json).
 *
 *   pap status
 *   pap seal <name> [--max-reads 10] [--days 7]      value from stdin or a hidden prompt
 *   pap secret list
 *   pap secret get <name> --reason "..." [--stdout]  default: writes ~/.pap/secrets/<name> (0600)
 *   pap secret exec <name> --reason "..." -- <cmd…>  runs cmd with PAP_SECRET_<NAME> in its env only
 *
 * Exit codes: 0 ok · 1 error · 4 rejected by the human · 5 expired / timed out
 */
import { spawn } from "node:child_process";
import { loadIdentity, type Identity } from "./identity.js";
import { openBrowser } from "./relay.js";
import { awaitReveal, envName, ExpiredError, listSecrets, RejectedError, requestReveal, seal, writeSecretFile } from "./secrets.js";

const WAIT_MS = Number(process.env.PAP_WAIT_MS ?? 5 * 60_000);
const err = (m: string, code = 1): never => {
  process.stderr.write(`pap: ${m}\n`);
  process.exit(code);
};

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}
function bool(args: string[], name: string) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

function identity(): Identity {
  const id = loadIdentity();
  if (!id) err("no agent identity at ~/.pap/agent.json — connect the agent first (MCP tool pap_connect)");
  if (!id!.ownerAddress) err("agent not paired with a phone yet — run pap_connect from your agent first");
  return id!;
}

async function readValue(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  }
  process.stderr.write("Secret value (hidden, Enter to finish): ");
  return new Promise((resolve) => {
    let v = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write("\n");
          return resolve(v);
        }
        if (c === "\u0003") err("cancelled");
        if (c === "\u007f") v = v.slice(0, -1);
        else v += c;
      }
    });
  });
}

async function reveal(id: Identity, name: string, reason: string | undefined) {
  if (!reason) err('--reason "why you need it" is required (your human reads it on the phone)');
  const { requestId, url, showUrl } = await requestReveal(id, name, reason!);
  process.stderr.write(`Waiting for approval on your phone… (QR: ${showUrl} · phone: ${url})\n`);
  openBrowser(showUrl);
  try {
    const v = await awaitReveal(id, requestId, name, WAIT_MS);
    if (v === null) err("timed out waiting for the phone", 5);
    return v!;
  } catch (e) {
    if (e instanceof RejectedError) err(e.message, 4);
    if (e instanceof ExpiredError) err(e.message, 5);
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args.shift();

  if (cmd === "status") {
    const id = loadIdentity();
    if (!id) return console.log("No agent identity. Connect your agent with the MCP tool pap_connect.");
    console.log(`agent  ${id.name} ${id.address}\nowner  ${id.ownerAddress ?? "not paired"}${id.agentId ? ` · agentId #${id.agentId}` : ""}\nrelay  ${id.relay}`);
    return;
  }

  if (cmd === "seal") {
    const maxReads = Number(flag(args, "max-reads") ?? 10);
    const days = Number(flag(args, "days") ?? 7);
    const name = args[0] ?? err("usage: pap seal <name> [--max-reads 10] [--days 7]");
    if (!Number.isInteger(maxReads) || maxReads < 1) err("--max-reads must be a positive integer");
    if (!(days > 0)) err("--days must be > 0");
    const id = identity();
    const value = await readValue();
    if (!value) err("empty value");
    const r = await seal(id, name, value, { maxReads, days });
    console.log(`🔒 Sealed "${name}" for ${id.name}: only opens with its signature + yours. The relay holds ciphertext only.`);
    console.log(`Approve on your phone to activate it (${maxReads} reads, ${days} days): ${r.url}`);
    if (r.replaces) console.log(`(replaces the current "${name}" once approved)`);
    openBrowser(r.showUrl);
    return;
  }

  if (cmd === "secret") {
    const sub = args.shift();
    if (sub === "list") {
      const list = await listSecrets(identity());
      if (!list.length) return console.log("No sealed secrets. Add one with: pap seal <name>");
      for (const s of list)
        console.log(`${s.name.padEnd(20)} ${s.status.padEnd(8)} ${s.reads}/${s.maxReads} reads  expires ${new Date(Number(s.expiry) * 1000).toISOString().slice(0, 10)}`);
      return;
    }
    if (sub === "get") {
      const reason = flag(args, "reason");
      const toStdout = bool(args, "stdout");
      const name = args[0] ?? err('usage: pap secret get <name> --reason "..." [--stdout]');
      const v = await reveal(identity(), name, reason);
      if (toStdout) process.stdout.write(v);
      else console.log(writeSecretFile(name, v));
      return;
    }
    if (sub === "exec") {
      const dd = args.indexOf("--");
      if (dd === -1) err('usage: pap secret exec <name> --reason "..." -- <command…>');
      const command = args.splice(dd).slice(1);
      const reason = flag(args, "reason");
      const name = args[0] ?? err("secret name required");
      if (!command.length) err("command required after --");
      const v = await reveal(identity(), name, reason);
      const child = spawn(command[0], command.slice(1), { stdio: "inherit", env: { ...process.env, [envName(name)]: v } });
      child.on("exit", (code) => process.exit(code ?? 1));
      return;
    }
  }

  console.log(`pap — Passport Agent Protocol CLI

  pap status
  pap seal <name> [--max-reads 10] [--days 7]       seal a credential for your agent (value from stdin or hidden prompt)
  pap secret list
  pap secret get <name> --reason "..." [--stdout]   ask your phone; writes ~/.pap/secrets/<name> unless --stdout
  pap secret exec <name> --reason "..." -- <cmd…>   run <cmd> with ${envName("<name>")} set only for it

Exit codes: 0 ok · 1 error · 4 rejected · 5 expired`);
  if (cmd && cmd !== "help" && cmd !== "--help") process.exit(1);
}

main().catch((e) => err((e as Error).message));
