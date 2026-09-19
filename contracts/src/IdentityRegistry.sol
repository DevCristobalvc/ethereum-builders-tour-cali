// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title IdentityRegistry — minimal ERC-8004 Identity Registry
/// @notice Each agent is an ERC-721 token whose URI resolves to its registration file.
///         Interface-compatible subset of EIP-8004 (register / setAgentURI / agentWallet).
contract IdentityRegistry is ERC721 {
    uint256 private _nextId = 1;
    mapping(uint256 => string) private _agentURIs;
    mapping(uint256 => address) private _agentWallets;
    mapping(address => uint256) private _agentIdOfWallet;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);

    error NotAgentOwner();

    constructor() ERC721("ERC-8004 Agent", "AGENT") {}

    modifier onlyAgentOwner(uint256 agentId) {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _;
    }

    /// @notice Register an agent owned by msg.sender; agent wallet defaults to msg.sender.
    function register(string calldata agentURI) external returns (uint256 agentId) {
        return _register(agentURI, msg.sender);
    }

    /// @notice Register an agent owned by msg.sender (the human) with a separate,
    ///         fund-less identity key for the agent (`agentWallet`).
    function register(string calldata agentURI, address agentWallet) external returns (uint256 agentId) {
        return _register(agentURI, agentWallet);
    }

    function _register(string calldata agentURI, address agentWallet) private returns (uint256 agentId) {
        agentId = _nextId++;
        _mint(msg.sender, agentId);
        _agentURIs[agentId] = agentURI;
        _agentWallets[agentId] = agentWallet;
        _agentIdOfWallet[agentWallet] = agentId;
        emit Registered(agentId, agentURI, msg.sender);
        emit AgentWalletSet(agentId, agentWallet);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external onlyAgentOwner(agentId) {
        _agentURIs[agentId] = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /// @dev EIP-8004 requires a signature from the new wallet; simplified for the hackathon.
    function setAgentWallet(uint256 agentId, address newWallet) external onlyAgentOwner(agentId) {
        delete _agentIdOfWallet[_agentWallets[agentId]];
        _agentWallets[agentId] = newWallet;
        _agentIdOfWallet[newWallet] = agentId;
        emit AgentWalletSet(agentId, newWallet);
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallets[agentId];
    }

    /// @notice Reverse lookup (0 if the wallet is not an agent identity key).
    function agentIdOf(address agentWallet) external view returns (uint256) {
        return _agentIdOfWallet[agentWallet];
    }

    function tokenURI(uint256 agentId) public view override returns (string memory) {
        _requireOwned(agentId);
        return _agentURIs[agentId];
    }

    function totalAgents() external view returns (uint256) {
        return _nextId - 1;
    }
}
