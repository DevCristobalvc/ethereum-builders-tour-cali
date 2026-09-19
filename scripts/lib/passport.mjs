// Shared helpers: build the vetted-agent Merkle set and produce Groth16 proofs
// using zkpjwt-core's circuit (Poseidon Merkle membership, 10 levels, 1 public signal = root).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MerkleTreeBuilder } from "zkpjwt-core";
import * as snarkjs from "snarkjs";

const require = createRequire(import.meta.url);
const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "zkpjwt-core");
export const ASSETS = {
  wasm: join(pkgDir, "assets", "merkle_membership.wasm"),
  zkey: join(pkgDir, "assets", "merkle_final.zkey"),
  vkey: join(pkgDir, "assets", "verification_key.json"),
};

export const LEVELS = 10;

export async function buildSet(addresses) {
  const builder = new MerkleTreeBuilder({ levels: LEVELS });
  await builder.initialize();
  const tree = await builder.buildTree(addresses);
  return { builder, tree };
}

export async function proveMembership(builder, address) {
  const merkleProof = builder.getMerkleProof(address);
  const input = {
    address: merkleProof.addressHash.toString(),
    pathIndices: merkleProof.pathIndices,
    siblings: merkleProof.siblings.map((s) => s.toString()),
    root: merkleProof.root.toString(),
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, ASSETS.wasm, ASSETS.zkey);
  return { proof, publicSignals, root: BigInt(publicSignals[0]) };
}

export async function verifyLocal({ proof, publicSignals }) {
  const vkey = JSON.parse(readFileSync(ASSETS.vkey, "utf8"));
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/** Convert snarkjs proof to the (pA, pB, pC) tuple expected by Groth16Verifier.sol */
export function toSolidityArgs({ proof }) {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    // snarkjs swaps the G2 coordinate order for Solidity
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]],
  };
}
