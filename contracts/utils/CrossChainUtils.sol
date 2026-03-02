// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ReentrancyGuard } from "solady/utils/ReentrancyGuard.sol";
import { Ownable }         from "solady/auth/Ownable.sol";
import { SafeTransferLib } from "solady/utils/SafeTransferLib.sol";
import { FixedPointMathLib } from "solady/utils/FixedPointMathLib.sol";

/**
 * @title CrossChainUtils
 * @notice Solady-powered utility library for LayerZero V2 cross-chain operations.
 *
 * Provides:
 *  - Fee estimation helpers
 *  - Address ↔ bytes32 packing (LayerZero peer format)
 *  - Gas buffer calculation
 *  - Refund management via SafeTransferLib
 *  - Pausable emergency stop (inline assembly, ERC-7201 slot)
 *
 * All heavy lifting uses Solady — zero OpenZeppelin imports.
 */
abstract contract CrossChainUtils is ReentrancyGuard, Ownable {

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidEid(uint32 eid);
    error InsufficientFee(uint256 required, uint256 provided);
    error RefundFailed(address recipient, uint256 amount);
    error Paused();
    error NotPaused();

    // ─── Events ───────────────────────────────────────────────────────────────

    event FeeRefunded(address indexed recipient, uint256 amount);
    event CrossChainSent(uint32 indexed dstEid, address indexed from, uint256 tokenId, bytes32 guid);
    event PeerSet(uint32 indexed eid, bytes32 peer);
    event ContractPaused(address by);
    event ContractUnpaused(address by);

    // ─── Pausable (Solady-style, ERC-7201 namespaced slot) ───────────────────

    /// @dev `not(_PAUSED_SLOT)` avoids collision with zero-default storage.
    uint256 private constant _PAUSED_SLOT = 0x5eff0e8d42e3bf68;

    modifier whenNotPaused() {
        if (_isPaused()) revert Paused();
        _;
    }

    modifier whenPaused() {
        if (!_isPaused()) revert NotPaused();
        _;
    }

    function paused() external view returns (bool) {
        return _isPaused();
    }

    function pause() external onlyOwner whenNotPaused {
        assembly { sstore(not(_PAUSED_SLOT), 1) }
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyOwner whenPaused {
        assembly { sstore(not(_PAUSED_SLOT), 0) }
        emit ContractUnpaused(msg.sender);
    }

    function _isPaused() internal view returns (bool result) {
        assembly { result := sload(not(_PAUSED_SLOT)) }
    }

    // ─── Peer Registry ────────────────────────────────────────────────────────

    /// @dev eid → trusted peer (bytes32 LayerZero format)
    mapping(uint32 => bytes32) private _peers;

    /**
     * @notice Register a trusted remote contract for a destination chain.
     * @param eid   LayerZero destination endpoint ID
     * @param peer  Remote contract address, left-padded to bytes32
     */
    function setPeer(uint32 eid, bytes32 peer) external onlyOwner {
        if (eid == 0)          revert InvalidEid(eid);
        if (peer == bytes32(0)) revert ZeroAddress();
        _peers[eid] = peer;
        emit PeerSet(eid, peer);
    }

    /**
     * @notice Returns the trusted peer for an eid, reverts if unset.
     */
    function getPeer(uint32 eid) public view returns (bytes32 peer) {
        peer = _peers[eid];
        if (peer == bytes32(0)) revert InvalidEid(eid);
    }

    /**
     * @notice Returns true when a peer is registered for the given eid.
     */
    function hasPeer(uint32 eid) public view returns (bool) {
        return _peers[eid] != bytes32(0);
    }

    // ─── Address ↔ bytes32 Conversion ────────────────────────────────────────

    /**
     * @notice Pack an EVM address into LayerZero's 32-byte peer format.
     * @dev    Equivalent to `bytes32(uint256(uint160(addr)))`.
     */
    function addressToBytes32(address addr) public pure returns (bytes32 result) {
        assembly {
            result := and(addr, 0xffffffffffffffffffffffffffffffffffffffff)
        }
    }

    /**
     * @notice Unpack a 32-byte LayerZero peer into an EVM address.
     */
    function bytes32ToAddress(bytes32 b) public pure returns (address result) {
        assembly {
            result := and(b, 0xffffffffffffffffffffffffffffffffffffffff)
        }
    }

    // ─── Fee Helpers ──────────────────────────────────────────────────────────

    /**
     * @notice Add a safety buffer to a quoted LayerZero fee.
     * @param  quotedFee  Raw fee from `quote()` on the OFT contract.
     * @param  bps        Buffer in basis points (e.g. 500 = 5 %).
     * @return            Fee with buffer applied (always >= quotedFee).
     */
    function addFeeBuffer(uint256 quotedFee, uint256 bps) public pure returns (uint256) {
        // quotedFee + quotedFee * bps / 10_000
        return quotedFee + FixedPointMathLib.mulDiv(quotedFee, bps, 10_000);
    }

    /**
     * @notice Validate that msg.value covers the required fee, then refund surplus.
     * @param  required  Minimum fee that must be paid.
     */
    function _validateAndRefundFee(uint256 required) internal nonReentrant {
        if (msg.value < required) revert InsufficientFee(required, msg.value);

        uint256 surplus = msg.value - required;
        if (surplus > 0) {
            SafeTransferLib.forceSafeTransferETH(msg.sender, surplus);
            emit FeeRefunded(msg.sender, surplus);
        }
    }

    // ─── Gas Limit Utilities ──────────────────────────────────────────────────

    /**
     * @notice Estimate a safe destination gas limit by scaling a base value.
     * @param  baseGas     Gas used in a local reference execution.
     * @param  multiplier  Scale factor in basis points (e.g. 15000 = 1.5×).
     * @return             Recommended `_gas` to pass into LZ `MessagingFee`.
     */
    function estimateDstGas(uint256 baseGas, uint256 multiplier) public pure returns (uint256) {
        return FixedPointMathLib.mulDiv(baseGas, multiplier, 10_000);
    }

    // ─── Emergency Ether Recovery ─────────────────────────────────────────────

    /**
     * @notice Sweep all ETH held by this contract to the owner.
     * @dev    Uses Solady SafeTransferLib — reverts on failure.
     */
    function rescueETH() external onlyOwner {
        uint256 bal = address(this).balance;
        SafeTransferLib.forceSafeTransferETH(owner(), bal);
    }

    /**
     * @notice Sweep an ERC-20 token balance to the owner (e.g. stuck WETH).
     * @param  token  ERC-20 token contract address.
     */
    function rescueERC20(address token) external onlyOwner {
        uint256 bal = SafeTransferLib.balanceOf(token, address(this));
        SafeTransferLib.safeTransfer(token, owner(), bal);
    }

    // ─── Option Encoding (LayerZero V2) ──────────────────────────────────────

    /**
     * @notice Encode a `TYPE_3` LayerZero option that sets a destination gas limit.
     * @dev    Format: 0x0003 | uint16(option-type=1) | uint128(gasLimit)
     *         See: https://docs.layerzero.network/v2/developers/evm/gas-settings/options
     * @param  gasLimit  Gas units to allocate on the destination chain.
     * @return           ABI-compatible option bytes.
     */
    function encodeGasOption(uint128 gasLimit) public pure returns (bytes memory) {
        // executor option type 1 = set gas
        return abi.encodePacked(
            uint16(3),      // option type: TYPE_3
            uint8(1),       // executor option type: GAS
            uint128(gasLimit)
        );
    }

    /**
     * @notice Encode a TYPE_3 option that sends extra native value to the receiver.
     * @param  gasLimit    Gas for destination execution.
     * @param  nativeValue Wei amount to airdrop to the receiver on dst chain.
     * @param  receiver    Address that receives the airdropped native tokens.
     * @return             ABI-compatible option bytes.
     */
    function encodeGasAndNativeDropOption(
        uint128 gasLimit,
        uint128 nativeValue,
        address receiver
    ) public pure returns (bytes memory) {
        return abi.encodePacked(
            uint16(3),        // TYPE_3
            uint8(1),         // GAS option
            uint128(gasLimit),
            uint8(2),         // NATIVE_DROP option
            uint128(nativeValue),
            receiver
        );
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Returns the contract's current ETH balance.
     */
    function ethBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
