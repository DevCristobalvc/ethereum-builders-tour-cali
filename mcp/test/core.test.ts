import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { publicKeyToAddress } from "viem/utils";
import {
  blobHash,
  eciesDecrypt,
  eciesEncrypt,
  openAgentLayer,
  peelOwnerLayer,
  publicKeyFromMessageSig,
  publicKeyFromTypedSig,
  publicKeyOf,
  sealSecret,
  secretScope,
  typedData,
} from "../src/pap-core.ts";

const agentPk = generatePrivateKey();
const ownerPk = generatePrivateKey();
const agent = privateKeyToAccount(agentPk);
const owner = privateKeyToAccount(ownerPk);
const target = { name: "openai", agent: agent.address, agentPub: agent.publicKey, ownerPub: owner.publicKey };
const expect = { name: "openai", agent: agent.address };
const PASSPORT = "0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B" as const;

test("seal → peel → open round-trip", async () => {
  const blob = await sealSecret("sk-test-123", target);
  assert.ok(!blob.includes("sk-test-123"));
  const inner = await peelOwnerLayer(blob, ownerPk, expect);
  assert.ok(!inner.includes("sk-test-123"));
  assert.equal(await openAgentLayer(inner, agentPk, expect), "sk-test-123");
});

test("the agent alone cannot open the stored blob", async () => {
  const blob = await sealSecret("s", target);
  await assert.rejects(openAgentLayer(blob, agentPk, expect));
  await assert.rejects(peelOwnerLayer(blob, agentPk, expect));
});

test("the phone alone cannot read the plaintext", async () => {
  const inner = await peelOwnerLayer(await sealSecret("s", target), ownerPk, expect);
  await assert.rejects(openAgentLayer(inner, ownerPk, expect));
});

test("a blob sealed for one agent/name does not open as another", async () => {
  const blob = await sealSecret("s", target);
  const other = privateKeyToAccount(generatePrivateKey()).address;
  await assert.rejects(peelOwnerLayer(blob, ownerPk, { name: "openai", agent: other }));
  await assert.rejects(peelOwnerLayer(blob, ownerPk, { name: "stripe", agent: agent.address }));
  const inner = await peelOwnerLayer(blob, ownerPk, expect);
  await assert.rejects(openAgentLayer(inner, agentPk, { name: "stripe", agent: agent.address }));
});

test("tampering one byte breaks authentication", async () => {
  const env = await eciesEncrypt(owner.publicKey, new TextEncoder().encode("hello"), "ctx");
  const flipped = { ...env, ct: (env.ct.slice(0, -2) + (env.ct.endsWith("00") ? "01" : "00")) as `0x${string}` };
  await assert.rejects(eciesDecrypt(ownerPk, flipped, "ctx"));
  await assert.rejects(eciesDecrypt(ownerPk, env, "other-ctx"));
  assert.equal(new TextDecoder().decode(await eciesDecrypt(ownerPk, env, "ctx")), "hello");
});

test("compressed and uncompressed public keys both work", async () => {
  const env = await eciesEncrypt(publicKeyOf(ownerPk), new TextEncoder().encode("x"), "c");
  assert.equal(new TextDecoder().decode(await eciesDecrypt(ownerPk, env, "c")), "x");
});

test("public key recovered from a personal_sign signature", async () => {
  const sig = await agent.signMessage({ message: "PAP:pair:{}" });
  assert.equal(await publicKeyFromMessageSig("PAP:pair:{}", sig), agent.publicKey);
});

test("EIP-712 reveal request: sign, recover, and any field change invalidates", async () => {
  const msg = { agent: agent.address, name: "openai", reason: "run integration tests", nonce: "n1", expiry: 2_000_000_000n };
  const sig = await agent.signTypedData(typedData(PASSPORT, "RevealRequest", msg));
  assert.equal(publicKeyToAddress(await publicKeyFromTypedSig(PASSPORT, "RevealRequest", msg, sig)), agent.address);
  for (const changed of [{ reason: "exfiltrate" }, { name: "stripe" }, { nonce: "n2" }]) {
    const pub = await publicKeyFromTypedSig(PASSPORT, "RevealRequest", { ...msg, ...changed }, sig);
    assert.notEqual(publicKeyToAddress(pub), agent.address);
  }
});

test("EIP-712 reveal approval binds the released blob", async () => {
  const msg = { requestId: "r1", agent: agent.address, name: "openai", resultHash: blobHash("inner-1") };
  const sig = await owner.signTypedData(typedData(PASSPORT, "RevealApproval", msg));
  assert.equal(publicKeyToAddress(await publicKeyFromTypedSig(PASSPORT, "RevealApproval", msg, sig)), owner.address);
  const swapped = await publicKeyFromTypedSig(PASSPORT, "RevealApproval", { ...msg, resultHash: blobHash("inner-2") }, sig);
  assert.notEqual(publicKeyToAddress(swapped), owner.address);
});

test("secret scope = keccak256(bytes('secret:' + name)), distinct per name", () => {
  assert.equal(secretScope("openai"), keccak256(toBytes("secret:openai")));
  assert.notEqual(secretScope("openai"), secretScope("stripe"));
});
