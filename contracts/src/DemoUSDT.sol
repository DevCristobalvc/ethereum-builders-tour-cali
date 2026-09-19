// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DemoUSDT — demo stablecoin for the hackathon (HashKey Chain testnet)
/// @notice 6 decimals like USDT. Anyone can mint; testnet only.
contract DemoUSDT is ERC20 {
    constructor() ERC20("Demo USDT", "demoUSDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Convenience faucet: 1,000 demoUSDT to caller.
    function faucet() external {
        _mint(msg.sender, 1_000 * 10 ** 6);
    }
}
