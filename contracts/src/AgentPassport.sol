// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IdentityRegistry} from "./IdentityRegistry.sol";

/// @title AgentPassport — on-chain trail of "the human authorised X for agent Y"
/// @notice The human (owner of the agent NFT) grants scoped, capped, time-limited permissions.
///         Every authorised action is recorded against its grant, so anyone can audit what an
///         agent was allowed to do and what it actually did. Actual value transfer happens
///         elsewhere (the human's wallet signs); this contract is the accountability layer.
contract AgentPassport {
    using SafeERC20 for IERC20;

    struct Grant {
        uint256 limit; // max cumulative amount for this scope (0 = no cap)
        uint256 spent;
        uint64 expiry; // unix ts, 0 = never
        bool active;
    }

    IdentityRegistry public immutable identity;

    // agentId => scope => grant
    mapping(uint256 => mapping(bytes32 => Grant)) private _grants;

    event PermissionGranted(
        uint256 indexed agentId, bytes32 indexed scope, uint256 limit, uint64 expiry, address indexed grantedBy
    );
    event PermissionRevoked(uint256 indexed agentId, bytes32 indexed scope, address indexed revokedBy);
    event ActionRecorded(
        uint256 indexed agentId, bytes32 indexed scope, uint256 amount, bytes32 indexed ref, address recordedBy
    );
    event Paid(
        uint256 indexed agentId, address indexed token, address indexed to, uint256 amount, bytes32 ref, address by
    );

    error NotAgentOwner();
    error NotAuthorised();
    error NoGrant();
    error GrantExpired();
    error LimitExceeded();

    constructor(IdentityRegistry identity_) {
        identity = identity_;
    }

    modifier onlyAgentOwner(uint256 agentId) {
        if (identity.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _;
    }

    /// @notice Human authorises `scope` (e.g. keccak256("transfer:demoUSDT")) for the agent.
    function grant(uint256 agentId, bytes32 scope, uint256 limit, uint64 expiry) external onlyAgentOwner(agentId) {
        _grants[agentId][scope] = Grant({limit: limit, spent: 0, expiry: expiry, active: true});
        emit PermissionGranted(agentId, scope, limit, expiry, msg.sender);
    }

    function revoke(uint256 agentId, bytes32 scope) external onlyAgentOwner(agentId) {
        _grants[agentId][scope].active = false;
        emit PermissionRevoked(agentId, scope, msg.sender);
    }

    /// @notice Scope used by `pay` for a given ERC-20 token.
    function transferScope(address token) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("transfer:", token));
    }

    /// @notice Record an authorised action. Callable by the human (owner) or the agent wallet.
    /// @param ref  Reference to the underlying action (e.g. tx hash, request id).
    function record(uint256 agentId, bytes32 scope, uint256 amount, bytes32 ref) external {
        _consume(agentId, scope, amount, ref);
    }

    /// @notice Pay `amount` of `token` from the human's wallet to `to`, within the agent's visa.
    ///         The human approves this contract once at onboarding; afterwards the agent wallet
    ///         can pay autonomously and the limit / expiry are enforced on-chain.
    function pay(uint256 agentId, address token, address to, uint256 amount, bytes32 ref) external {
        address owner = _consume(agentId, transferScope(token), amount, ref);
        IERC20(token).safeTransferFrom(owner, to, amount);
        emit Paid(agentId, token, to, amount, ref, msg.sender);
    }

    function _consume(uint256 agentId, bytes32 scope, uint256 amount, bytes32 ref) private returns (address owner) {
        owner = identity.ownerOf(agentId);
        if (msg.sender != owner && msg.sender != identity.getAgentWallet(agentId)) revert NotAuthorised();

        Grant storage g = _grants[agentId][scope];
        if (!g.active) revert NoGrant();
        if (g.expiry != 0 && block.timestamp > g.expiry) revert GrantExpired();
        if (g.limit != 0 && g.spent + amount > g.limit) revert LimitExceeded();

        g.spent += amount;
        emit ActionRecorded(agentId, scope, amount, ref, msg.sender);
    }

    function getGrant(uint256 agentId, bytes32 scope)
        external
        view
        returns (uint256 limit, uint256 spent, uint64 expiry, bool active)
    {
        Grant storage g = _grants[agentId][scope];
        return (g.limit, g.spent, g.expiry, g.active);
    }

    /// @notice True if the agent may currently perform `amount` under `scope`.
    function canAct(uint256 agentId, bytes32 scope, uint256 amount) external view returns (bool) {
        Grant storage g = _grants[agentId][scope];
        if (!g.active) return false;
        if (g.expiry != 0 && block.timestamp > g.expiry) return false;
        if (g.limit != 0 && g.spent + amount > g.limit) return false;
        return true;
    }
}
