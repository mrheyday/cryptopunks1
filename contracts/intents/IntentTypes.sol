// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IntentTypes
 * @notice Data structures and EIP-712 type hashes for the cross-chain intent system.
 *
 * Intent flow:
 *   1. Owner signs a CrossChainIntent off-chain (EIP-712).
 *   2. A solver submits the signed intent to IntentEngine.fillIntent().
 *   3. IntentEngine verifies the signature, executes the cross-chain send,
 *      and pays the solver a bounty = maxFee - actualFee.
 */

// ─── Core Intent Struct ───────────────────────────────────────────────────────

/**
 * @notice Describes a user's desired cross-chain NFT transfer.
 *
 * @param tokenId   The punk / NFT token ID to send.
 * @param dstEid    LayerZero destination endpoint ID.
 * @param receiver  Recipient address on the destination chain.
 * @param maxFee    Maximum native fee the user is willing to pay (wei).
 *                  Solver keeps the surplus over actual LZ fee as bounty.
 * @param nonce     Per-user counter — prevents replay of the same intent.
 * @param expiry    Unix timestamp after which the intent is invalid.
 */
struct CrossChainIntent {
    uint256 tokenId;
    uint32  dstEid;
    address receiver;
    uint256 maxFee;
    uint256 nonce;
    uint256 expiry;
}

// ─── Intent Status ────────────────────────────────────────────────────────────

enum IntentStatus {
    Pending,
    Filled,
    Cancelled,
    Expired
}

// ─── EIP-712 Type Hash ────────────────────────────────────────────────────────

/**
 * @dev keccak256 of the canonical EIP-712 type string for CrossChainIntent.
 *
 *   CrossChainIntent(
 *     uint256 tokenId,
 *     uint32  dstEid,
 *     address receiver,
 *     uint256 maxFee,
 *     uint256 nonce,
 *     uint256 expiry
 *   )
 */
bytes32 constant INTENT_TYPEHASH = keccak256(
    "CrossChainIntent("
        "uint256 tokenId,"
        "uint32 dstEid,"
        "address receiver,"
        "uint256 maxFee,"
        "uint256 nonce,"
        "uint256 expiry"
    ")"
);

// ─── Intent Hash Helper ────────────────────────────────────────────────────────

/**
 * @notice Compute the struct hash of a CrossChainIntent (first step of EIP-712).
 */
function hashIntent(CrossChainIntent memory intent) pure returns (bytes32) {
    return keccak256(abi.encode(
        INTENT_TYPEHASH,
        intent.tokenId,
        intent.dstEid,
        intent.receiver,
        intent.maxFee,
        intent.nonce,
        intent.expiry
    ));
}
