// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";

/// "Passport stamps": list every ActionRecorded for an agentId from the live AgentPassport.
/// forge script script/ReadHistory.s.sol --sig "run(uint256)" 6 --rpc-url hashkey_testnet
contract ReadHistory is Script {
    // ActionRecorded(uint256 indexed agentId, bytes32 indexed scope, uint256 amount, bytes32 indexed ref, address recordedBy)
    bytes32 constant TOPIC = keccak256("ActionRecorded(uint256,bytes32,uint256,bytes32,address)");
    uint256 constant DEPLOY_BLOCK = 33334362; // deployments/133.json deploy block

    function run(uint256 agentId) external {
        string memory json = vm.readFile(string.concat("../deployments/", vm.toString(block.chainid), ".json"));
        address passport = vm.parseJsonAddress(json, ".AgentPassport");

        bytes32[] memory topics = new bytes32[](2);
        topics[0] = TOPIC;
        topics[1] = bytes32(agentId);

        VmSafe.EthGetLogs[] memory logs = vm.eth_getLogs(DEPLOY_BLOCK, block.number, passport, topics);
        console.log("agentId", agentId, "stamps:", logs.length);
        for (uint256 i = 0; i < logs.length; i++) {
            (uint256 amount, address by) = abi.decode(logs[i].data, (uint256, address));
            console.log("--- #%d block %d tx %s", i + 1, logs[i].blockNumber, vm.toString(logs[i].transactionHash));
            console.log("    scope  ", vm.toString(logs[i].topics[2]));
            console.log("    ref    ", vm.toString(logs[i].topics[3]));
            console.log("    amount ", amount, " by ", by);
        }
    }
}
