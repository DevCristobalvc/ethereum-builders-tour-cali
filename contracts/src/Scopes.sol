// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Scopes — naming convention for AgentPassport visa scopes
/// @notice A scope is any bytes32; AgentPassport does not interpret it. This library fixes the
///         convention so wallets, gates and explorers agree on the meaning:
///
///   transfer:<token>              keccak256(abi.encodePacked("transfer:", token))            amount = token units
///   call:<contract>:<selector>    keccak256(abi.encodePacked("call:", target, selector))     amount = 1 per call
///   sign:<domain>                 keccak256(abi.encodePacked("sign:", domain))               amount = 1 per signature
///   secret:<name>                 keccak256(abi.encodePacked("secret:", name))               amount = 1 per read
///
///   Countable actions use limit = N (N uses) or type(uint256).max (unlimited); amount = 1.
///   Used only off-chain / in tests and scripts — AgentPassport itself is unchanged.
library Scopes {
    function transfer(address token) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("transfer:", token));
    }

    function call(address target, bytes4 selector) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("call:", target, selector));
    }

    function sign(string memory domain) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("sign:", domain));
    }

    function secret(string memory name) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("secret:", name));
    }
}
