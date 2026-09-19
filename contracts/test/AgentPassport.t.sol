// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {DemoUSDT} from "../src/DemoUSDT.sol";

contract AgentPassportTest is Test {
    IdentityRegistry identity;
    AgentPassport passport;
    DemoUSDT usdt;

    address human = makeAddr("human");
    address agentKey = makeAddr("agentKey");
    address stranger = makeAddr("stranger");

    bytes32 constant SCOPE = keccak256("transfer:demoUSDT");
    uint256 agentId;

    function setUp() public {
        identity = new IdentityRegistry();
        passport = new AgentPassport(identity);
        usdt = new DemoUSDT();

        vm.prank(human);
        agentId = identity.register("https://pap.devcristobalvc.com/agents/1.json", agentKey);
    }

    function test_registerWithAgentWallet() public view {
        assertEq(identity.ownerOf(agentId), human);
        assertEq(identity.getAgentWallet(agentId), agentKey);
        assertEq(identity.agentIdOf(agentKey), agentId);
        assertEq(identity.agentIdOf(stranger), 0);
    }

    function test_demoUSDT() public {
        assertEq(usdt.decimals(), 6);
        vm.prank(human);
        usdt.faucet();
        assertEq(usdt.balanceOf(human), 1_000e6);
        usdt.mint(stranger, 5e6);
        assertEq(usdt.balanceOf(stranger), 5e6);
    }

    function test_grantAndRecord() public {
        vm.prank(human);
        vm.expectEmit(true, true, true, true);
        emit AgentPassport.PermissionGranted(agentId, SCOPE, 100e6, 0, human);
        passport.grant(agentId, SCOPE, 100e6, 0);

        assertTrue(passport.canAct(agentId, SCOPE, 10e6));

        vm.prank(agentKey);
        vm.expectEmit(true, true, true, true);
        emit AgentPassport.ActionRecorded(agentId, SCOPE, 10e6, bytes32(uint256(0xabc)), agentKey);
        passport.record(agentId, SCOPE, 10e6, bytes32(uint256(0xabc)));

        (uint256 limit, uint256 spent,, bool active) = passport.getGrant(agentId, SCOPE);
        assertEq(limit, 100e6);
        assertEq(spent, 10e6);
        assertTrue(active);
    }

    function test_humanCanRecordToo() public {
        vm.prank(human);
        passport.grant(agentId, SCOPE, 0, 0);
        vm.prank(human);
        passport.record(agentId, SCOPE, 1, bytes32(0));
    }

    function test_strangerCannotRecord() public {
        vm.prank(human);
        passport.grant(agentId, SCOPE, 0, 0);
        vm.prank(stranger);
        vm.expectRevert(AgentPassport.NotAuthorised.selector);
        passport.record(agentId, SCOPE, 1, bytes32(0));
    }

    function test_onlyOwnerGrants() public {
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.NotAgentOwner.selector);
        passport.grant(agentId, SCOPE, 1, 0);
    }

    function test_noGrantReverts() public {
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.NoGrant.selector);
        passport.record(agentId, SCOPE, 1, bytes32(0));
    }

    function test_limitExceeded() public {
        vm.prank(human);
        passport.grant(agentId, SCOPE, 10e6, 0);
        vm.prank(agentKey);
        passport.record(agentId, SCOPE, 7e6, bytes32(0));
        assertFalse(passport.canAct(agentId, SCOPE, 4e6));
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.LimitExceeded.selector);
        passport.record(agentId, SCOPE, 4e6, bytes32(0));
    }

    function test_expiry() public {
        vm.prank(human);
        passport.grant(agentId, SCOPE, 0, uint64(block.timestamp + 1 hours));
        vm.warp(block.timestamp + 2 hours);
        assertFalse(passport.canAct(agentId, SCOPE, 1));
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.GrantExpired.selector);
        passport.record(agentId, SCOPE, 1, bytes32(0));
    }

    function test_revoke() public {
        vm.prank(human);
        passport.grant(agentId, SCOPE, 0, 0);
        vm.prank(human);
        passport.revoke(agentId, SCOPE);
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.NoGrant.selector);
        passport.record(agentId, SCOPE, 1, bytes32(0));
    }
}
