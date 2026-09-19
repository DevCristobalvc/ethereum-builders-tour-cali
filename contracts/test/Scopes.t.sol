// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {DemoUSDT} from "../src/DemoUSDT.sol";
import {Scopes} from "../src/Scopes.sol";

/// "Visas for any action": AgentPassport.record() works with arbitrary scopes.
contract ScopesTest is Test {
    IdentityRegistry identity;
    AgentPassport passport;
    DemoUSDT usdt;

    address human = makeAddr("human");
    address agentKey = makeAddr("agentKey");
    uint256 agentId;

    function setUp() public {
        identity = new IdentityRegistry();
        passport = new AgentPassport(identity);
        usdt = new DemoUSDT();
        vm.prank(human);
        agentId = identity.register("ipfs://agent", agentKey);
    }

    function test_transferScopeMatchesPassport() public view {
        assertEq(Scopes.transfer(address(usdt)), passport.transferScope(address(usdt)));
    }

    function test_signScope_countable() public {
        bytes32 scope = Scopes.sign("pap.devcristobalvc.com");
        vm.prank(human);
        passport.grant(agentId, scope, 3, 0); // 3 signatures allowed

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(agentKey);
            passport.record(agentId, scope, 1, keccak256(abi.encode("msg", i)));
        }
        assertFalse(passport.canAct(agentId, scope, 1));
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.LimitExceeded.selector);
        passport.record(agentId, scope, 1, bytes32(0));
    }

    function test_callScope_unlimited() public {
        bytes32 scope = Scopes.call(address(usdt), DemoUSDT.faucet.selector);
        vm.prank(human);
        passport.grant(agentId, scope, type(uint256).max, uint64(block.timestamp + 1 hours));

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(agentKey);
            passport.record(agentId, scope, 1, bytes32(i));
        }
        assertTrue(passport.canAct(agentId, scope, 1));

        vm.warp(block.timestamp + 2 hours);
        assertFalse(passport.canAct(agentId, scope, 1)); // expired
    }

    function test_secretScope_singleUse() public {
        bytes32 scope = Scopes.secret("OPENAI_API_KEY");
        vm.prank(human);
        passport.grant(agentId, scope, 1, 0);

        vm.prank(agentKey);
        vm.expectEmit(true, true, true, true);
        emit AgentPassport.ActionRecorded(agentId, scope, 1, keccak256("read-1"), agentKey);
        passport.record(agentId, scope, 1, keccak256("read-1"));

        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.LimitExceeded.selector);
        passport.record(agentId, scope, 1, keccak256("read-2"));
    }

    function test_scopesAreIndependent() public {
        bytes32 a = Scopes.sign("a");
        bytes32 b = Scopes.sign("b");
        vm.prank(human);
        passport.grant(agentId, a, 1, 0);
        vm.prank(agentKey);
        passport.record(agentId, a, 1, bytes32(0));
        // b was never granted
        vm.prank(agentKey);
        vm.expectRevert(AgentPassport.NoGrant.selector);
        passport.record(agentId, b, 1, bytes32(0));
    }

    function testFuzz_anyScope(bytes32 scope, uint128 limit, uint128 amount) public {
        vm.assume(limit > 0 && amount > 0);
        vm.prank(human);
        passport.grant(agentId, scope, limit, 0);
        vm.prank(agentKey);
        if (amount > limit) {
            vm.expectRevert(AgentPassport.LimitExceeded.selector);
            passport.record(agentId, scope, amount, bytes32(0));
        } else {
            passport.record(agentId, scope, amount, bytes32(0));
            (, uint256 spent,,) = passport.getGrant(agentId, scope);
            assertEq(spent, amount);
        }
    }
}
