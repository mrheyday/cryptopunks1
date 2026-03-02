// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ReentrancyGuard }  from "solady/utils/ReentrancyGuard.sol";
import { Ownable }           from "solady/auth/Ownable.sol";
import { SafeTransferLib }   from "solady/utils/SafeTransferLib.sol";
import { CrossChainUtils }   from "./CrossChainUtils.sol";

/**
 * @title CrossChainReceiver
 * @notice Destination-chain (to-chain) template for LayerZero V2 message receipt.
 *
 * Inherit alongside OFT721 / OApp so your contract can safely handle
 * inbound cross-chain messages with:
 *  - Sender whitelist (only accept from known peers)
 *  - Message deduplication (replay protection via GUID registry)
 *  - Structured receive hook that child contracts override
 *
 * All utilities imported from `solady/utils/` — no OpenZeppelin.
 */
abstract contract CrossChainReceiver is CrossChainUtils {

    // ─── Errors ───────────────────────────────────────────────────────────────

    error UnauthorizedSender(uint32 eid, bytes32 sender);
    error DuplicateMessage(bytes32 guid);
    error InvalidPayload(uint256 length);

    // ─── Events ───────────────────────────────────────────────────────────────

    event MessageReceived(uint32 indexed srcEid, bytes32 indexed sender, bytes32 guid, uint256 tokenId);
    event MessageDropped(uint32 indexed srcEid, bytes32 indexed sender, bytes32 guid, bytes reason);

    // ─── Replay Protection ────────────────────────────────────────────────────

    /// @dev guid → processed flag
    mapping(bytes32 => bool) private _processedGuids;

    /**
     * @notice Returns true if a cross-chain message has already been processed.
     */
    function isProcessed(bytes32 guid) external view returns (bool) {
        return _processedGuids[guid];
    }

    // ─── Internal Receive Logic ───────────────────────────────────────────────

    /**
     * @notice Validate and dispatch an inbound LayerZero message.
     *
     * Call this from your contract's `_lzReceive` override:
     *
     *   function _lzReceive(
     *     Origin calldata _origin,
     *     bytes32 _guid,
     *     bytes calldata _message,
     *     address, uint256
     *   ) internal override {
     *     _handleReceive(_origin.srcEid, _origin.sender, _guid, _message);
     *   }
     *
     * @param srcEid   Source endpoint ID.
     * @param sender   Sender address as bytes32 (LayerZero peer format).
     * @param guid     Unique message identifier (used for dedup).
     * @param payload  ABI-encoded message body.
     */
    function _handleReceive(
        uint32  srcEid,
        bytes32 sender,
        bytes32 guid,
        bytes calldata payload
    ) internal {
        // 1. Verify trusted sender
        bytes32 trustedPeer = _peers(srcEid);
        if (trustedPeer == bytes32(0) || trustedPeer != sender) {
            revert UnauthorizedSender(srcEid, sender);
        }

        // 2. Replay guard
        if (_processedGuids[guid]) revert DuplicateMessage(guid);
        _processedGuids[guid] = true;

        // 3. Basic payload sanity
        if (payload.length < 32) revert InvalidPayload(payload.length);

        // 4. Dispatch to child implementation
        try this._onReceive(srcEid, sender, guid, payload) {
            (uint256 tokenId) = abi.decode(payload[:32], (uint256));
            emit MessageReceived(srcEid, sender, guid, tokenId);
        } catch (bytes memory reason) {
            // Emit a drop event instead of reverting so LZ doesn't block the channel
            emit MessageDropped(srcEid, sender, guid, reason);
        }
    }

    /**
     * @notice Hook called after validation — override in your NFT contract.
     *
     * @param srcEid   Source chain endpoint ID.
     * @param sender   Verified peer address (bytes32).
     * @param guid     Unique message ID.
     * @param payload  ABI-encoded token transfer data.
     *
     * Suggested decode pattern:
     *
     *   (uint256 tokenId, address to) = abi.decode(payload, (uint256, address));
     *   _safeMint(to, tokenId);
     */
    function _onReceive(
        uint32  srcEid,
        bytes32 sender,
        bytes32 guid,
        bytes calldata payload
    ) external virtual;

    // ─── Internal Peer Lookup ─────────────────────────────────────────────────

    /// @dev Reads the peer mapping from CrossChainUtils without exposing setter here.
    function _peers(uint32 eid) internal view returns (bytes32) {
        // Re-uses the public `hasPeer` / `getPeer` logic from CrossChainUtils
        if (!hasPeer(eid)) return bytes32(0);
        return getPeer(eid);
    }
}
