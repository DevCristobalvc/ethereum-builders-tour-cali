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

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);

    error NotAgentOwner();

    constructor() ERC721("ERC-8004 Agent", "AGENT") {}

    modifier onlyAgentOwner(uint256 agentId) {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _;
    }

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextId++;
        _mint(msg.sender, agentId);
        _agentURIs[agentId] = agentURI;
        // Default agent wallet is the registering EOA; can be changed later.
        _agentWallets[agentId] = msg.sender;
        emit Registered(agentId, agentURI, msg.sender);
        emit AgentWalletSet(agentId, msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external onlyAgentOwner(agentId) {
        _agentURIs[agentId] = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /// @dev EIP-8004 requires a signature from the new wallet; simplified for the hackathon.
    function setAgentWallet(uint256 agentId, address newWallet) external onlyAgentOwner(agentId) {
        _agentWallets[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallets[agentId];
    }

    function tokenURI(uint256 agentId) public view override returns (string memory) {
        _requireOwned(agentId);
        return _agentURIs[agentId];
    }

    function totalAgents() external view returns (uint256) {
        return _nextId - 1;
    }
}
