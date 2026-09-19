// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {DemoUSDT} from "../src/DemoUSDT.sol";

/// Iteration 2 demo — "the human approves once, the agent operates inside the visa".
/// Reads deployments/<chainId>.json. Env:
///   PRIVATE_KEY        human (owner of the agent NFT)
///   AGENT_PRIVATE_KEY  agent identity key (no funds needed except gas, see FundAgent)
///   AGENT_ID           agentId to use (default: register a new one)
///   TO                 recipient (default: TEST_ADDRESS)
///
/// forge script script/AgentPay.s.sol --rpc-url hashkey_testnet --broadcast
contract AgentPay is Script {
    function run() external {
        uint256 humanPk = vm.envUint("PRIVATE_KEY");
        uint256 agentPk = vm.envUint("AGENT_PRIVATE_KEY");
        address human = vm.addr(humanPk);
        address agent = vm.addr(agentPk);
        address to = vm.envOr("TO", vm.envAddress("TEST_ADDRESS"));

        string memory json = vm.readFile(string.concat("../deployments/", vm.toString(block.chainid), ".json"));
        IdentityRegistry identity = IdentityRegistry(vm.parseJsonAddress(json, ".IdentityRegistry"));
        AgentPassport passport = AgentPassport(vm.parseJsonAddress(json, ".AgentPassport"));
        DemoUSDT usdt = DemoUSDT(vm.parseJsonAddress(json, ".DemoUSDT"));
        bytes32 scope = passport.transferScope(address(usdt));

        // ---- Act 1: human onboards the agent and issues a visa (one-time) ----
        uint256 agentId = vm.envOr("AGENT_ID", uint256(0));
        vm.startBroadcast(humanPk);
        if (agentId == 0) {
            agentId = identity.register("https://pap.devcristobalvc.com/agents/demo.json", agent);
            console.log("registered agentId", agentId, "owner", human);
        }
        if (usdt.allowance(human, address(passport)) < 100e6) {
            usdt.approve(address(passport), type(uint256).max);
        }
        passport.grant(agentId, scope, 100e6, uint64(block.timestamp + 1 days)); // visa: 100 demoUSDT / 24h
        vm.stopBroadcast();
        console.log("visa granted: 100 demoUSDT, 24h, scope transfer:demoUSDT");

        // ---- Act 2: the AGENT pays on its own, no human signature ----
        vm.startBroadcast(agentPk);
        passport.pay(agentId, address(usdt), to, 10e6, keccak256("invoice-001"));
        console.log("agent paid 10 demoUSDT to", to);
        vm.stopBroadcast();

        (uint256 limit, uint256 spent,,) = passport.getGrant(agentId, scope);
        console.log("visa spent/limit:", spent / 1e6, "/", limit / 1e6);
        console.log("agent can pay 500?", passport.canAct(agentId, scope, 500e6)); // false: over the visa
    }
}

/// Send 0.002 HSK to an agent key so it can pay gas.
/// forge script script/AgentPay.s.sol:FundAgent --sig "run(address)" <agent> --rpc-url hashkey_testnet --broadcast
contract FundAgent is Script {
    function run(address agent) external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        payable(agent).transfer(0.002 ether);
        vm.stopBroadcast();
        console.log("funded", agent, "balance (wei):", agent.balance);
    }
}
