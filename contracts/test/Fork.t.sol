// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {DemoUSDT} from "../src/DemoUSDT.sol";

/// Integration tests against the live HashKey Chain testnet deployment (deployments/133.json).
/// Run: forge test --match-contract Fork --fork-url https://testnet.hsk.xyz
/// Skipped automatically when not running on a chainId 133 fork.
contract ForkTest is Test {
    uint256 constant HSK_TESTNET = 133;

    // State created by the PAP E2E demo (pairing + one 10 demoUSDT payment).
    uint256 constant AGENT_ID = 4;
    address constant HUMAN = 0xc52aA97742103df9E9B1E5965BA5a274A985B856;
    address constant AGENT_KEY = 0xB68fc1c6Ec41EB7250B3354D5e5d761DCBa103bF;

    IdentityRegistry identity;
    AgentPassport passport;
    DemoUSDT usdt;
    bytes32 scope;

    function setUp() public {
        if (block.chainid != HSK_TESTNET) return;
        string memory json = vm.readFile("../deployments/133.json");
        identity = IdentityRegistry(vm.parseJsonAddress(json, ".IdentityRegistry"));
        passport = AgentPassport(vm.parseJsonAddress(json, ".AgentPassport"));
        usdt = DemoUSDT(vm.parseJsonAddress(json, ".DemoUSDT"));
        scope = passport.transferScope(address(usdt));
    }

    modifier onlyFork() {
        if (block.chainid != HSK_TESTNET) {
            vm.skip(true);
        }
        _;
    }

    function testFork_agent4_identity() public onlyFork {
        assertEq(identity.ownerOf(AGENT_ID), HUMAN, "human owns agent NFT");
        assertEq(identity.getAgentWallet(AGENT_ID), AGENT_KEY, "agent identity key");
        assertEq(identity.agentIdOf(AGENT_KEY), AGENT_ID, "reverse lookup");
        assertGe(identity.totalAgents(), 4);
    }

    function testFork_agent4_visa() public onlyFork {
        (uint256 limit, uint256 spent, uint64 expiry, bool active) = passport.getGrant(AGENT_ID, scope);
        assertTrue(active, "visa active");
        assertEq(limit, 100e6, "visa limit 100 demoUSDT");
        assertGe(spent, 10e6, "at least the E2E payment of 10 was spent");
        assertLe(spent, limit, "never over the visa");
        assertGt(expiry, 0);
    }

    function testFork_agentPaysInsideVisa_andIsBlockedOutside() public onlyFork {
        (uint256 limit, uint256 spent,,) = passport.getGrant(AGENT_ID, scope);
        uint256 remaining = limit - spent;
        address maria = makeAddr("maria");

        // Agent key pays autonomously, no human signature.
        vm.prank(AGENT_KEY);
        passport.pay(AGENT_ID, address(usdt), maria, 1e6, keccak256("fork-test"));
        assertEq(usdt.balanceOf(maria), 1e6);

        // Anything beyond the remaining visa reverts on-chain.
        vm.prank(AGENT_KEY);
        vm.expectRevert(AgentPassport.LimitExceeded.selector);
        passport.pay(AGENT_ID, address(usdt), maria, remaining, keccak256("too-much"));
    }
}
