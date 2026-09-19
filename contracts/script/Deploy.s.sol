// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {PassportRegistry} from "../src/PassportRegistry.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {DemoUSDT} from "../src/DemoUSDT.sol";

/// forge script script/Deploy.s.sol --rpc-url hashkey_testnet --broadcast
/// (PRIVATE_KEY read from contracts/.env via `source .env` or --private-key)
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        IdentityRegistry identity = new IdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry(identity);
        AgentPassport agentPassport = new AgentPassport(identity);
        DemoUSDT usdt = new DemoUSDT();
        Groth16Verifier verifier = new Groth16Verifier();
        PassportRegistry zkPassport = new PassportRegistry(verifier, deployer);

        vm.stopBroadcast();

        console.log("chainId:            ", block.chainid);
        console.log("deployer:           ", deployer);
        console.log("IdentityRegistry:   ", address(identity));
        console.log("ReputationRegistry: ", address(reputation));
        console.log("AgentPassport:      ", address(agentPassport));
        console.log("DemoUSDT:           ", address(usdt));
        console.log("Groth16Verifier:    ", address(verifier));
        console.log("PassportRegistry:   ", address(zkPassport));

        string memory json = "deploy";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "deployer", deployer);
        vm.serializeAddress(json, "IdentityRegistry", address(identity));
        vm.serializeAddress(json, "ReputationRegistry", address(reputation));
        vm.serializeAddress(json, "AgentPassport", address(agentPassport));
        vm.serializeAddress(json, "DemoUSDT", address(usdt));
        vm.serializeAddress(json, "Groth16Verifier", address(verifier));
        string memory out = vm.serializeAddress(json, "PassportRegistry", address(zkPassport));
        vm.writeJson(out, string.concat("../deployments/", vm.toString(block.chainid), ".json"));
    }
}
