// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AgentPassport} from "../src/AgentPassport.sol";

/// Sealed secrets reuse AgentPassport unchanged: scope = keccak256("secret:" + name),
/// limit = max reads, one record() per read (see mcp/src/pap-core.ts secretScope / revealRef).
contract SecretVisaTest is Test {
    IdentityRegistry identity;
    AgentPassport passport;

    address human = makeAddr("human");
    address agentKey = makeAddr("agentKey");
    address stranger = makeAddr("stranger");
    uint256 agentId;

    bytes32 constant OPENAI = keccak256("secret:openai");
    bytes32 constant STRIPE = keccak256("secret:stripe");

    function setUp() public {
        identity = new IdentityRegistry();
        passport = new AgentPassport(identity);
        vm.prank(human);
        agentId = identity.register("https://pap.devcristobalvc.com/agents/1.json", agentKey);
    }

    function _ref(string memory requestId) internal pure returns (bytes32) {
        return keccak256(bytes(string.concat("pap:reveal:", requestId)));
    }

    function test_scopeMatchesOffChainHelper() public pure {
        // keccak256(stringToHex("secret:openai")) in pap-core.ts
        assertEq(OPENAI, keccak256(bytes(string.concat("secret:", "openai"))));
        assertTrue(OPENAI != STRIPE);
    }

    function test_readsUpToLimitThenLimitExceeded() public {
        vm.prank(human);
        passport.grant(agentId, OPENAI, 2, uint64(block.timestamp + 7 days));

        vm.startPrank(human); // the phone stamps each approved read
        vm.expectEmit(true, true, true, true);
        emit AgentPassport.ActionRecorded(agentId, OPENAI, 1, _ref("r1"), human);
        passport.record(agentId, OPENAI, 1, _ref("r1"));
        passport.record(agentId, OPENAI, 1, _ref("r2"));
        assertFalse(passport.canAct(agentId, OPENAI, 1));
        vm.expectRevert(AgentPassport.LimitExceeded.selector);
        passport.record(agentId, OPENAI, 1, _ref("r3"));
        vm.stopPrank();

        (uint256 limit, uint256 spent,,) = passport.getGrant(agentId, OPENAI);
        assertEq(limit, 2);
        assertEq(spent, 2);
    }

    function test_expiredSecretCannotBeRead() public {
        vm.prank(human);
        passport.grant(agentId, OPENAI, 10, uint64(block.timestamp + 1 days));
        vm.warp(block.timestamp + 1 days + 1);
        assertFalse(passport.canAct(agentId, OPENAI, 1));
        vm.prank(human);
        vm.expectRevert(AgentPassport.GrantExpired.selector);
        passport.record(agentId, OPENAI, 1, _ref("late"));
    }

    function test_revokeBlocksReads() public {
        vm.startPrank(human);
        passport.grant(agentId, OPENAI, 10, uint64(block.timestamp + 1 days));
        passport.revoke(agentId, OPENAI);
        vm.expectRevert(AgentPassport.NoGrant.selector);
        passport.record(agentId, OPENAI, 1, _ref("after-revoke"));
        vm.stopPrank();
    }

    function test_scopesAreIndependent() public {
        vm.prank(human);
        passport.grant(agentId, OPENAI, 1, uint64(block.timestamp + 1 days));
        assertFalse(passport.canAct(agentId, STRIPE, 1));
        vm.prank(human);
        vm.expectRevert(AgentPassport.NoGrant.selector);
        passport.record(agentId, STRIPE, 1, _ref("x"));
    }

    function test_onlyOwnerGrantsAndStrangersCannotStamp() public {
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.NotAgentOwner.selector);
        passport.grant(agentId, OPENAI, 100, 0);

        vm.prank(human);
        passport.grant(agentId, OPENAI, 5, 0);
        vm.prank(stranger);
        vm.expectRevert(AgentPassport.NotAuthorised.selector);
        passport.record(agentId, OPENAI, 1, _ref("x"));
    }
}
