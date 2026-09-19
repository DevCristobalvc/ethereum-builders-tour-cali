// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DemoUSDT} from "../src/DemoUSDT.sol";

/// Post-deploy seed for the demo. Reads deployments/<chainId>.json.
/// forge script script/Seed.s.sol --rpc-url hashkey_testnet --broadcast
contract Seed is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address maria = vm.envAddress("TEST_ADDRESS");

        string memory json = vm.readFile(string.concat("../deployments/", vm.toString(block.chainid), ".json"));
        DemoUSDT usdt = DemoUSDT(vm.parseJsonAddress(json, ".DemoUSDT"));

        vm.startBroadcast(pk);
        usdt.mint(deployer, 10_000e6);
        usdt.mint(maria, 10_000e6);
        payable(maria).transfer(0.002 ether);
        vm.stopBroadcast();

        console.log("demoUSDT deployer:", usdt.balanceOf(deployer) / 1e6);
        console.log("demoUSDT maria:   ", usdt.balanceOf(maria) / 1e6);
        console.log("HSK maria (wei):  ", maria.balance);
    }
}
