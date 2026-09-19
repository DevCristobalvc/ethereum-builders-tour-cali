// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IdentityRegistry} from "./IdentityRegistry.sol";

/// @title ReputationRegistry — minimal ERC-8004 Reputation Registry
/// @notice Clients post bounded feedback about agents. Only `value`, `valueDecimals`,
///         tags and revoked flag are stored; URIs are only emitted (as in EIP-8004).
contract ReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    IdentityRegistry public immutable identity;

    // agentId => client => feedback list
    mapping(uint256 => mapping(address => Feedback[])) private _feedback;
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _isClient;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );
    event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex);

    error UnknownAgent();
    error SelfFeedback();
    error NoSuchFeedback();

    constructor(IdentityRegistry identity_) {
        identity = identity_;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        if (identity.ownerOf(agentId) == address(0)) revert UnknownAgent();
        if (identity.ownerOf(agentId) == msg.sender) revert SelfFeedback();

        if (!_isClient[agentId][msg.sender]) {
            _isClient[agentId][msg.sender] = true;
            _clients[agentId].push(msg.sender);
        }
        Feedback[] storage list = _feedback[agentId][msg.sender];
        uint64 index = uint64(list.length);
        list.push(Feedback({value: value, valueDecimals: valueDecimals, tag1: tag1, tag2: tag2, isRevoked: false}));

        emit NewFeedback(
            agentId, msg.sender, index, value, valueDecimals, tag1, tag1, tag2, endpoint, feedbackURI, feedbackHash
        );
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback[] storage list = _feedback[agentId][msg.sender];
        if (feedbackIndex >= list.length) revert NoSuchFeedback();
        list[feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /// @notice Sum of non-revoked feedback values from the given clients (all clients if empty).
    ///         Tags are ignored in this minimal version. Assumes all feedback uses the same decimals.
    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata, string calldata)
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
    {
        address[] memory clients = clientAddresses.length == 0 ? _clients[agentId] : _copy(clientAddresses);
        for (uint256 i = 0; i < clients.length; i++) {
            Feedback[] storage list = _feedback[agentId][clients[i]];
            for (uint256 j = 0; j < list.length; j++) {
                if (list[j].isRevoked) continue;
                count++;
                summaryValue += list[j].value;
                summaryValueDecimals = list[j].valueDecimals;
            }
        }
    }

    function _copy(address[] calldata a) private pure returns (address[] memory m) {
        m = new address[](a.length);
        for (uint256 i = 0; i < a.length; i++) {
            m[i] = a[i];
        }
    }

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked)
    {
        Feedback storage f = _feedback[agentId][clientAddress][feedbackIndex];
        return (f.value, f.valueDecimals, f.tag1, f.tag2, f.isRevoked);
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return uint64(_feedback[agentId][clientAddress].length);
    }
}
