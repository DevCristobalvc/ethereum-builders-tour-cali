// Generates a real Groth16 proof fixture for Foundry tests.
// Output: contracts/test/fixtures/proof.json
import { writeFileSync, mkdirSync } from "node:fs";
import { buildSet, proveMembership, verifyLocal, toSolidityArgs } from "./lib/passport.mjs";

const VETTED = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
];

const { builder } = await buildSet(VETTED);
const zk = await proveMembership(builder, VETTED[1]);
if (!(await verifyLocal(zk))) throw new Error("local verification failed");

const fixture = { ...toSolidityArgs(zk), root: zk.root.toString(), setSize: VETTED.length };
mkdirSync("../contracts/test/fixtures", { recursive: true });
writeFileSync("../contracts/test/fixtures/proof.json", JSON.stringify(fixture, null, 2));
console.log("fixture written, root =", fixture.root);
process.exit(0);
