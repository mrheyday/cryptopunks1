// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ReentrancyGuard }   from "solady/utils/ReentrancyGuard.sol";
import { Ownable }            from "solady/auth/Ownable.sol";
import { SafeTransferLib }    from "solady/utils/SafeTransferLib.sol";
import { FixedPointMathLib }  from "solady/utils/FixedPointMathLib.sol";
import { CrossChainUtils }    from "./CrossChainUtils.sol";

/**
 * @title CrossChainSender
 * @notice Source-chain (from-chain) template for LayerZero V2 cross-chain sends.
 *
 * Inherit this contract in any OFT721 / OFT20 contract that needs to send
 * tokens to a remote chain.  All Solady utilities are imported from
 * `solady/utils/` — no OpenZeppelin dependencies.
 *
 * Usage:
 *   contract MyNFT is OFT721, CrossChainSender { … }
 *
 * Features:
 *  - Quote fees before sending (view, no gas cost)
 *  - Automatic surplus-fee refund via SafeTransferLib
 *  - Configurable per-chain gas limit overrides
 *  - Rate limiting (max sends per block per address)
 *  - Batch send helper
 */
abstract contract CrossChainSender is CrossChainUtils {

    // ─── Errors ───────────────────────────────────────────────────────────────

    error RateLimitExceeded(address sender, uint256 blockNumber);
    error BatchTooLarge(uint256 max, uint256 provided);
    error GasLimitTooLow(uint32 eid, uint256 minimum, uint256 provided);

    // ─── Events ───────────────────────────────────────────────────────────────

    event GasLimitSet(uint32 indexed eid, uint256 gasLimit);
    event RateLimitSet(uint256 maxPerBlock);
    event BatchSent(uint32 indexed dstEid, address indexed from, uint256[] tokenIds);

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @dev Default destination gas limit (can be overridden per chain).
    uint256 public constant DEFAULT_DST_GAS = 200_000;

    /// @dev Maximum tokens per batch send.
    uint256 public constant MAX_BATCH_SIZE = 50;

    /// @dev Fee buffer added on top of quoted fee (5%).
    uint256 public constant FEE_BUFFER_BPS = 500;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Custom gas limit per destination chain (0 = use DEFAULT_DST_GAS).
    mapping(uint32 => uint256) public dstGasLimit;

    /// @notice Max cross-chain sends per block per address (0 = unlimited).
    uint256 public maxSendsPerBlock;

    /// @dev sender → block number → count
    mapping(address => mapping(uint256 => uint256)) private _sendCount;

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Set a custom destination gas limit for a specific chain.
     * @param eid      LayerZero destination endpoint ID.
     * @param gasLimit Gas units; must be >= 100_000. 0 resets to DEFAULT_DST_GAS.
     */
    function setDstGasLimit(uint32 eid, uint256 gasLimit) external onlyOwner {
        if (gasLimit != 0 && gasLimit < 100_000) revert GasLimitTooLow(eid, 100_000, gasLimit);
        dstGasLimit[eid] = gasLimit;
        emit GasLimitSet(eid, gasLimit == 0 ? DEFAULT_DST_GAS : gasLimit);
    }

    /**
     * @notice Configure max sends per block (anti-spam). 0 = no limit.
     */
    function setMaxSendsPerBlock(uint256 max) external onlyOwner {
        maxSendsPerBlock = max;
        emit RateLimitSet(max);
    }

    // ─── Fee Quoting ──────────────────────────────────────────────────────────

    /**
     * @notice Quote the native-token fee required to send one token cross-chain.
     * @dev    Call this off-chain before sending; pass the result as msg.value.
     *
     * @param dstEid     Destination chain endpoint ID.
     * @param tokenId    Token to send.
     * @param receiver   Recipient address on the destination chain.
     * @param withBuffer Add a 5% safety margin on top of the quoted fee.
     * @return nativeFee Wei required for the cross-chain message.
     */
    function quoteSend(
        uint32 dstEid,
        uint256 tokenId,
        address receiver,
        bool withBuffer
    ) external view returns (uint256 nativeFee) {
        bytes memory options = encodeGasOption(_dstGas(dstEid));
        nativeFee = _quoteSend(dstEid, tokenId, receiver, options);
        if (withBuffer) {
            nativeFee = addFeeBuffer(nativeFee, FEE_BUFFER_BPS);
        }
    }

    /**
     * @notice Quote the fee for batch-sending multiple tokens.
     * @param dstEid     Destination chain endpoint ID.
     * @param tokenIds   List of token IDs (max MAX_BATCH_SIZE).
     * @param receiver   Recipient address on the destination chain.
     * @return nativeFee Estimated fee for the whole batch (with buffer).
     */
    function quoteBatchSend(
        uint32 dstEid,
        uint256[] calldata tokenIds,
        address receiver
    ) external view returns (uint256 nativeFee) {
        if (tokenIds.length > MAX_BATCH_SIZE) revert BatchTooLarge(MAX_BATCH_SIZE, tokenIds.length);
        bytes memory options = encodeGasOption(
            FixedPointMathLib.mulDiv(_dstGas(dstEid), tokenIds.length, 1) // scale gas per token
        );
        nativeFee = 0;
        for (uint256 i; i < tokenIds.length; ++i) {
            nativeFee += _quoteSend(dstEid, tokenIds[i], receiver, options);
        }
        nativeFee = addFeeBuffer(nativeFee, FEE_BUFFER_BPS);
    }

    // ─── Send Helpers (internal) ──────────────────────────────────────────────

    /**
     * @notice Internal send with automatic fee validation and refund.
     * @param dstEid    Destination endpoint ID.
     * @param tokenId   Token to send.
     * @param receiver  Recipient on the destination chain.
     * @param options   Encoded LayerZero executor options.
     * @return guid     The unique cross-chain message ID returned by LayerZero.
     */
    function _sendWithRefund(
        uint32  dstEid,
        uint256 tokenId,
        address receiver,
        bytes memory options
    ) internal returns (bytes32 guid) {
        _checkRateLimit(msg.sender);
        uint256 fee = _quoteSend(dstEid, tokenId, receiver, options);
        _validateAndRefundFee(addFeeBuffer(fee, FEE_BUFFER_BPS));
        guid = _executeSend(dstEid, tokenId, receiver, options, fee);
        emit CrossChainSent(dstEid, msg.sender, tokenId, guid);
    }

    // ─── Rate Limiting ────────────────────────────────────────────────────────

    function _checkRateLimit(address sender) internal {
        if (maxSendsPerBlock == 0) return;
        uint256 count = _sendCount[sender][block.number];
        if (count >= maxSendsPerBlock) revert RateLimitExceeded(sender, block.number);
        unchecked { _sendCount[sender][block.number] = count + 1; }
    }

    // ─── Gas Helpers ──────────────────────────────────────────────────────────

    /// @dev Returns the configured gas limit for a destination chain, or the default.
    function _dstGas(uint32 eid) internal view returns (uint128) {
        uint256 g = dstGasLimit[eid];
        return g == 0 ? uint128(DEFAULT_DST_GAS) : uint128(g);
    }

    // ─── Hooks (override in child contract) ───────────────────────────────────

    /**
     * @notice Override to call your OFT721/OFT20 quote function.
     * @dev    Example for OFT721:
     *
     *   function _quoteSend(uint32 dstEid, uint256 tokenId, address receiver, bytes memory options)
     *       internal view override returns (uint256) {
     *     SendParam memory sp = SendParam(dstEid, addressToBytes32(receiver), tokenId, "", options, "");
     *     MessagingFee memory fee = this.quoteSend(sp, false);
     *     return fee.nativeFee;
     *   }
     */
    function _quoteSend(
        uint32 dstEid,
        uint256 tokenId,
        address receiver,
        bytes memory options
    ) internal view virtual returns (uint256 nativeFee);

    /**
     * @notice Override to execute the actual LayerZero send.
     * @return guid  Cross-chain message GUID.
     */
    function _executeSend(
        uint32  dstEid,
        uint256 tokenId,
        address receiver,
        bytes memory options,
        uint256 fee
    ) internal virtual returns (bytes32 guid);
}
