// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ── Solady imports (solady/utils/ and solady/auth/) ──────────────────────────
import { EIP712 }              from "solady/utils/EIP712.sol";
import { SignatureCheckerLib } from "solady/utils/SignatureCheckerLib.sol";
import { ReentrancyGuard }     from "solady/utils/ReentrancyGuard.sol";
import { Ownable }             from "solady/auth/Ownable.sol";
import { SafeTransferLib }     from "solady/utils/SafeTransferLib.sol";

// ── Local ────────────────────────────────────────────────────────────────────
import { CrossChainIntent, IntentStatus, INTENT_TYPEHASH, hashIntent } from "./IntentTypes.sol";
import { CrossChainUtils }  from "../utils/CrossChainUtils.sol";
import { CrossChainSender } from "../utils/CrossChainSender.sol";

/**
 * @title IntentEngine
 * @notice POC — intent-based cross-chain NFT transfers for CryptoPunks.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Intent flow                                                        │
 * │                                                                     │
 * │  1. Owner signs CrossChainIntent (EIP-712) off-chain               │
 * │  2. Solver calls fillIntent(intent, sig)                            │
 * │  3. Engine verifies: sig, expiry, nonce, token ownership, peer      │
 * │  4. Engine pulls token from owner (approve required first)          │
 * │  5. Engine pays LayerZero fee and sends the NFT cross-chain         │
 * │  6. Solver earns:  intent.maxFee - actualLzFee  (bounty)           │
 * │                                                                     │
 * │  Cancellation: owner can cancel any unfilled intent by nonce.       │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * All security primitives use Solady — zero OpenZeppelin.
 */
contract IntentEngine is EIP712, ReentrancyGuard, Ownable {

    // ─── Errors ───────────────────────────────────────────────────────────────

    error IntentExpired(uint256 expiry, uint256 blockTime);
    error IntentAlreadyUsed(address user, uint256 nonce);
    error IntentCancelled(address user, uint256 nonce);
    error BadSignature();
    error FeeTooHigh(uint256 actualFee, uint256 maxFee);
    error NoPeer(uint32 dstEid);
    error NotTokenOwner(uint256 tokenId, address expected, address actual);
    error ZeroAddress();
    error SolverBountyFailed(address solver, uint256 amount);

    // ─── Events ───────────────────────────────────────────────────────────────

    event IntentFilled(
        bytes32 indexed intentHash,
        address indexed user,
        address indexed solver,
        uint256 tokenId,
        uint32  dstEid,
        uint256 lzFee,
        uint256 solverBounty,
        bytes32 lzGuid
    );
    event IntentCancelledByUser(bytes32 indexed intentHash, address indexed user, uint256 nonce);
    event FeeVaultUpdated(address newVault);
    event ProtocolFeeUpdated(uint256 bps);

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice The CryptoPunksMarketV2 contract (source-chain NFT + LZ sender).
    address public immutable nftContract;

    /// @dev user → nonce → used/cancelled
    mapping(address => mapping(uint256 => IntentStatus)) private _nonceStatus;

    /// @notice Optional protocol fee on solver bounty (basis points, max 1000 = 10%).
    uint256 public protocolFeeBps;

    /// @notice Address that receives the protocol fee.
    address public feeVault;

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _nftContract  Address of CryptoPunksMarketV2 (must implement CrossChainSender).
     * @param _feeVault     Address that collects the protocol fee.
     * @param _protocolFee  Protocol fee in basis points (e.g. 50 = 0.5 %).
     */
    constructor(address _nftContract, address _feeVault, uint256 _protocolFee) {
        if (_nftContract == address(0) || _feeVault == address(0)) revert ZeroAddress();
        require(_protocolFee <= 1000, "IntentEngine: fee > 10%");

        _initializeOwner(msg.sender);
        nftContract   = _nftContract;
        feeVault      = _feeVault;
        protocolFeeBps = _protocolFee;
    }

    // ─── EIP-712 ──────────────────────────────────────────────────────────────

    function _domainNameAndVersion()
        internal pure override
        returns (string memory name, string memory version)
    {
        name    = "CryptoPunksIntentEngine";
        version = "1";
    }

    /**
     * @notice Compute the EIP-712 digest of a CrossChainIntent.
     * @dev    Use this to build the bytes the user must sign.
     */
    function intentDigest(CrossChainIntent calldata intent) public view returns (bytes32) {
        return _hashTypedData(hashIntent(intent));
    }

    // ─── Intent Execution ─────────────────────────────────────────────────────

    /**
     * @notice Fill a signed intent.  Called by a solver/relayer.
     *
     * Requirements:
     *  - `intent.expiry` has not passed
     *  - Nonce is not already used or cancelled
     *  - `sig` is a valid EIP-712 signature by the token owner
     *  - Token is owned by the signer
     *  - A peer is set for `intent.dstEid` on the NFT contract
     *  - `msg.value >= actualLzFee`
     *  - `intent.maxFee >= actualLzFee`
     *
     * Solver reward = intent.maxFee - actualLzFee - protocolFee
     *
     * @param intent  The cross-chain transfer intent.
     * @param sig     EIP-712 signature from the NFT owner.
     */
    function fillIntent(
        CrossChainIntent calldata intent,
        bytes calldata sig
    ) external payable nonReentrant {
        // ── 1. Expiry ──────────────────────────────────────────────────────
        if (block.timestamp > intent.expiry)
            revert IntentExpired(intent.expiry, block.timestamp);

        // ── 2. Nonce ───────────────────────────────────────────────────────
        bytes32 digest   = intentDigest(intent);
        address user     = _recoverSigner(digest, sig);
        IntentStatus ns  = _nonceStatus[user][intent.nonce];
        if (ns == IntentStatus.Filled)    revert IntentAlreadyUsed(user, intent.nonce);
        if (ns == IntentStatus.Cancelled) revert IntentCancelled(user, intent.nonce);

        // ── 3. Mark used (CEI: before external calls) ─────────────────────
        _nonceStatus[user][intent.nonce] = IntentStatus.Filled;

        // ── 4. Token ownership ─────────────────────────────────────────────
        address tokenOwner = _ownerOf(intent.tokenId);
        if (tokenOwner != user)
            revert NotTokenOwner(intent.tokenId, user, tokenOwner);

        // ── 5. Peer check ──────────────────────────────────────────────────
        if (!_hasPeer(intent.dstEid)) revert NoPeer(intent.dstEid);

        // ── 6. Quote actual LZ fee ─────────────────────────────────────────
        uint256 actualFee = _quoteIntentFee(intent);
        if (actualFee > intent.maxFee)
            revert FeeTooHigh(actualFee, intent.maxFee);
        if (msg.value < actualFee)
            revert FeeTooHigh(actualFee, msg.value);   // solver didn't fund enough

        // ── 7. Pull NFT from owner and execute send ────────────────────────
        //    (owner must have approved IntentEngine or set approvalForAll)
        bytes32 lzGuid = _executeLZSend(intent, actualFee);

        // ── 8. Distribute value ────────────────────────────────────────────
        uint256 surplus = intent.maxFee - actualFee;   // bounty pool

        // Protocol fee (taken from bounty pool)
        uint256 protocolFee;
        if (protocolFeeBps > 0 && surplus > 0) {
            protocolFee = (surplus * protocolFeeBps) / 10_000;
            if (protocolFee > 0) {
                SafeTransferLib.forceSafeTransferETH(feeVault, protocolFee);
            }
        }

        // Solver bounty (remainder)
        uint256 bounty = surplus - protocolFee;
        if (bounty > 0) {
            SafeTransferLib.forceSafeTransferETH(msg.sender, bounty);
        }

        // Refund any msg.value over actualFee back to solver
        uint256 solverOverpay = msg.value - actualFee;
        if (solverOverpay > 0) {
            SafeTransferLib.forceSafeTransferETH(msg.sender, solverOverpay);
        }

        emit IntentFilled(digest, user, msg.sender, intent.tokenId, intent.dstEid, actualFee, bounty, lzGuid);
    }

    // ─── Cancellation ─────────────────────────────────────────────────────────

    /**
     * @notice Cancel an intent before it is filled.
     * @dev    Only the signer (token owner) may cancel their own intent.
     */
    function cancelIntent(CrossChainIntent calldata intent) external {
        bytes32 digest = intentDigest(intent);
        // User must be the one cancelling — we don't verify a sig here,
        // we verify msg.sender matches what would be the signer.
        IntentStatus ns = _nonceStatus[msg.sender][intent.nonce];
        if (ns == IntentStatus.Filled)    revert IntentAlreadyUsed(msg.sender, intent.nonce);
        if (ns == IntentStatus.Cancelled) revert IntentCancelled(msg.sender, intent.nonce);

        _nonceStatus[msg.sender][intent.nonce] = IntentStatus.Cancelled;
        emit IntentCancelledByUser(digest, msg.sender, intent.nonce);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the status of a nonce for a given user.
     */
    function nonceStatus(address user, uint256 nonce) external view returns (IntentStatus) {
        return _nonceStatus[user][nonce];
    }

    /**
     * @notice Quote the LayerZero fee for an intent (without executing).
     */
    function quoteIntentFee(CrossChainIntent calldata intent) external view returns (uint256) {
        return _quoteIntentFee(intent);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setFeeVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert ZeroAddress();
        feeVault = newVault;
        emit FeeVaultUpdated(newVault);
    }

    function setProtocolFee(uint256 bps) external onlyOwner {
        require(bps <= 1000, "IntentEngine: fee > 10%");
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(bps);
    }

    function rescueETH() external onlyOwner {
        SafeTransferLib.forceSafeTransferETH(owner(), address(this).balance);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    /// @dev Recover signer from EIP-712 digest + signature using Solady.
    function _recoverSigner(bytes32 digest, bytes calldata sig) internal view returns (address signer) {
        bool valid;
        // SignatureCheckerLib.isValidSignatureNow works for both EOA and ERC-1271
        // We need the address first — extract it, then verify.
        signer = SignatureCheckerLib.recover(digest, sig);
        valid  = SignatureCheckerLib.isValidSignatureNow(signer, digest, sig);
        if (!valid) revert BadSignature();
    }

    /// @dev Call ownerOf on the NFT contract.
    function _ownerOf(uint256 tokenId) internal view returns (address owner_) {
        (bool ok, bytes memory data) = nftContract.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(ok && data.length >= 32, "IntentEngine: ownerOf failed");
        owner_ = abi.decode(data, (address));
    }

    /// @dev Check if the NFT contract has a peer for the destination chain.
    function _hasPeer(uint32 dstEid) internal view returns (bool) {
        (bool ok, bytes memory data) = nftContract.staticcall(
            abi.encodeWithSignature("hasPeer(uint32)", dstEid)
        );
        return ok && data.length >= 32 && abi.decode(data, (bool));
    }

    /// @dev Quote the LZ fee from the NFT contract.
    function _quoteIntentFee(CrossChainIntent calldata intent) internal view returns (uint256) {
        (bool ok, bytes memory data) = nftContract.staticcall(
            abi.encodeWithSignature(
                "quoteSend(uint32,uint256,address,bool)",
                intent.dstEid, intent.tokenId, intent.receiver, true
            )
        );
        require(ok && data.length >= 32, "IntentEngine: quoteSend failed");
        return abi.decode(data, (uint256));
    }

    /// @dev Execute the cross-chain send on the NFT contract.
    function _executeLZSend(
        CrossChainIntent calldata intent,
        uint256 fee
    ) internal returns (bytes32 guid) {
        // Build gas options
        (bool optOk, bytes memory options) = nftContract.staticcall(
            abi.encodeWithSignature("encodeGasOption(uint128)", uint128(200_000))
        );
        require(optOk, "IntentEngine: encodeGasOption failed");

        (bool ok, bytes memory data) = nftContract.call{ value: fee }(
            abi.encodeWithSignature(
                "sendPunkCrossChain(uint32,uint256,address,bytes)",
                intent.dstEid,
                intent.tokenId,
                intent.receiver,
                abi.decode(options, (bytes))
            )
        );
        require(ok, "IntentEngine: cross-chain send failed");
        if (data.length >= 32) guid = abi.decode(data, (bytes32));
    }

    // ─── Receive ETH ──────────────────────────────────────────────────────────

    receive() external payable {}
}
