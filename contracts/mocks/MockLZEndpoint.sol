// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockLZEndpoint
 * @notice Mock LayerZero endpoint for local testing
 * @dev Simplified version for testing purposes only
 */
contract MockLZEndpoint {
    mapping(address => mapping(uint32 => bytes32)) public peers;

    event MessageSent(
        uint32 indexed dstEid,
        bytes32 indexed to,
        bytes message,
        address sender
    );

    function send(
        uint32 dstEid,
        bytes32 to,
        bytes calldata message,
        address refundAddress
    ) external payable {
        emit MessageSent(dstEid, to, message, msg.sender);
    }

    function setPeer(uint32 eid, bytes32 peer) external {
        peers[msg.sender][eid] = peer;
    }

    function quote(
        uint32 /* dstEid */,
        bytes calldata /* message */,
        bool /* payInLzToken */
    ) external pure returns (uint256 nativeFee, uint256 lzTokenFee) {
        return (0.001 ether, 0);
    }
}
