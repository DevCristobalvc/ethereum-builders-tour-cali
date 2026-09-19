// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Groth16Verifier} from "./Groth16Verifier.sol";

/// @title PassportRegistry — anonymous agent passport
/// @notice The issuer (owner) publishes, per epoch, the Poseidon Merkle root of the set of
///         vetted agents (computed off-chain from ERC-8004 reputation). An agent proves
///         membership with a Groth16 proof whose only public signal is the root, so the
///         verifier learns "one of the vetted agents" but not which one.
///
///         Replay protection: the gate derives a `nullifier` per (agent, serviceId) off-chain
///         and consumes it here, so a passport can be used once per service per epoch.
contract PassportRegistry is Ownable {
    Groth16Verifier public immutable verifier;

    uint256 public currentEpoch;
    mapping(uint256 => uint256) public rootOf; // epoch => root
    mapping(uint256 => bool) public isRoot; // root => valid
    // serviceId => nullifier => used
    mapping(bytes32 => mapping(bytes32 => bool)) public nullifierUsed;

    event RootPublished(uint256 indexed epoch, uint256 root, uint256 setSize);
    event PassportVerified(bytes32 indexed serviceId, bytes32 indexed nullifier, uint256 root);

    error UnknownRoot();
    error InvalidProof();
    error NullifierAlreadyUsed();

    constructor(Groth16Verifier verifier_, address issuer) Ownable(issuer) {
        verifier = verifier_;
    }

    /// @notice Publish a new vetted-agent set. `setSize` is informational (anonymity set).
    function publishRoot(uint256 root, uint256 setSize) external onlyOwner returns (uint256 epoch) {
        epoch = ++currentEpoch;
        rootOf[epoch] = root;
        isRoot[root] = true;
        emit RootPublished(epoch, root, setSize);
    }

    /// @notice Pure check, no state change. Used by gates that manage nullifiers off-chain.
    function checkPassport(uint256[2] calldata pA, uint256[2][2] calldata pB, uint256[2] calldata pC, uint256 root)
        public
        view
        returns (bool)
    {
        if (!isRoot[root]) return false;
        return verifier.verifyProof(pA, pB, pC, [root]);
    }

    /// @notice Verify and consume a passport for `serviceId`. Reverts on failure.
    function verifyPassport(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256 root,
        bytes32 serviceId,
        bytes32 nullifier
    ) external {
        if (!isRoot[root]) revert UnknownRoot();
        if (nullifierUsed[serviceId][nullifier]) revert NullifierAlreadyUsed();
        if (!verifier.verifyProof(pA, pB, pC, [root])) revert InvalidProof();
        nullifierUsed[serviceId][nullifier] = true;
        emit PassportVerified(serviceId, nullifier, root);
    }
}
