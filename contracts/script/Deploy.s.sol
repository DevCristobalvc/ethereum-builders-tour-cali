// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {PassportRegistry} from "../src/PassportRegistry.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

/// forge script script/Deploy.s.sol --rpc-url hashkey_testnet --broadcast --private-key $PK
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        address issuer = msg.sender;

        IdentityRegistry identity = new IdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry(identity);
        Groth16Verifier verifier = new Groth16Verifier();
        PassportRegistry passport = new PassportRegistry(verifier, issuer);

        vm.stopBroadcast();

        console.log("IdentityRegistry:  ", address(identity));
        console.log("ReputationRegistry:", address(reputation));
        console.log("Groth16Verifier:   ", address(verifier));
        console.log("PassportRegistry:  ", address(passport));

        string memory json = "deploy";
        vm.serializeAddress(json, "IdentityRegistry", address(identity));
        vm.serializeAddress(json, "ReputationRegistry", address(reputation));
        vm.serializeAddress(json, "Groth16Verifier", address(verifier));
        vm.serializeAddress(json, "issuer", issuer);
        string memory out = vm.serializeAddress(json, "PassportRegistry", address(passport));
        vm.writeJson(out, string.concat("../deployments/", vm.toString(block.chainid), ".json"));
    }
}
