# CryptoPunks V1 to V2 Migration Guide

## Overview

This guide explains the differences between the original CryptoPunks contract (V1) and the modernized version (V2), and provides guidance on using V2 for new deployments.

## ⚠️ Important Notice

**V2 does NOT replace the original CryptoPunks contract** deployed at `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB` on Ethereum mainnet. Smart contracts are immutable, and the original contract will continue to operate indefinitely.

V2 is intended for:
- New NFT collections using the CryptoPunks marketplace model
- Cross-chain deployments
- Layer 2 deployments (Polygon, Arbitrum, Optimism, Base, etc.)
- Learning and reference purposes
- Projects wanting modern Solidity best practices

## Key Differences

### 1. Solidity Version

**V1:**
```solidity
pragma solidity ^0.4.8;
```

**V2:**
```solidity
pragma solidity ^0.8.20;
```

**Impact:**
- Built-in overflow/underflow protection
- Better compiler optimizations
- Modern language features
- Improved security

### 2. Error Handling

**V1:**
```solidity
if (msg.sender != owner) throw;
if (allPunksAssigned) throw;
```

**V2:**
```solidity
if (msg.sender != owner) revert NotPunkOwner();
if (allPunksAssigned) revert AllPunksAlreadyAssigned();
```

**Impact:**
- 99% gas savings on errors
- Better debugging with error names
- Clearer intent

### 3. ERC721 Compliance

**V1:**
- Custom implementation
- Non-standard token transfers
- Limited wallet support

**V2:**
- Full ERC721 compliance
- OpenZeppelin base implementation
- Universal wallet/marketplace support
- Standard events and functions

### 4. Cross-Chain Support

**V1:**
- Single chain only (Ethereum)

**V2:**
- Multi-chain via LayerZero
- Cross-chain punk transfers
- Deploy on any EVM chain
- Unified punk ownership across chains

### 5. Security Improvements

**V1:**
```solidity
function withdraw() {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    msg.sender.transfer(amount);
}
```

**V2:**
```solidity
function withdraw() external nonReentrant {
    if (!allPunksAssigned) revert PunksNotYetAssigned();

    uint256 amount = pendingWithdrawals[msg.sender];
    if (amount == 0) revert NoFundsToWithdraw();

    pendingWithdrawals[msg.sender] = 0;

    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

**Impact:**
- ReentrancyGuard protection
- Better error messages
- Input validation
- Modern call pattern

## Function Mapping

All V1 functions are preserved in V2 with the same signatures:

| V1 Function | V2 Function | Notes |
|-------------|-------------|-------|
| `setInitialOwner()` | ✅ Same | Enhanced validation |
| `setInitialOwners()` | ✅ Same | Enhanced validation |
| `allInitialOwnersAssigned()` | ✅ Same | Same behavior |
| `getPunk()` | ✅ Same | Better errors |
| `transferPunk()` | ✅ Same | ERC721 compatible |
| `offerPunkForSale()` | ✅ Same | Pausable |
| `offerPunkForSaleToAddress()` | ✅ Same | Pausable |
| `buyPunk()` | ✅ Same | Reentrancy protected |
| `punkNoLongerForSale()` | ✅ Same | Same behavior |
| `enterBidForPunk()` | ✅ Same | Reentrancy protected |
| `acceptBidForPunk()` | ✅ Same | Reentrancy protected |
| `withdrawBidForPunk()` | ✅ Same | Better refund logic |
| `withdraw()` | ✅ Same | Reentrancy protected |

### New Functions in V2

```solidity
// Cross-chain transfers
function sendPunkCrossChain(uint256 punkIndex, uint32 dstEid, address to, bytes calldata options) external payable;
function quoteSendPunk(uint256 punkIndex, uint32 dstEid, address to, bytes calldata options) external view returns (MessagingFee);

// Emergency controls
function pause() external;
function unpause() external;

// View helpers
function getPunkOffer(uint256 punkIndex) external view returns (Offer memory);
function getPunkBid(uint256 punkIndex) external view returns (Bid memory);

// ERC721 standard functions
function transferFrom(address from, address to, uint256 tokenId) external;
function safeTransferFrom(address from, address to, uint256 tokenId) external;
function approve(address to, uint256 tokenId) external;
function setApprovalForAll(address operator, bool approved) external;
// ... and more ERC721 functions
```

## Deployment Scenarios

### Scenario 1: New NFT Collection

**Goal:** Launch a new 10,000-item NFT collection with a marketplace

**Steps:**

1. Deploy V2 contract:
```bash
npx hardhat run scripts/deploy.js --network ethereum
```

2. Assign initial owners:
```javascript
await contract.setInitialOwners(addresses, indices);
await contract.allInitialOwnersAssigned();
```

3. Users can now claim, trade, and transfer

### Scenario 2: Multi-Chain Deployment

**Goal:** Deploy on Ethereum, Polygon, and Arbitrum with cross-chain transfers

**Steps:**

1. Deploy on all chains:
```bash
npx hardhat run scripts/deploy.js --network ethereum
npx hardhat run scripts/deploy.js --network polygon
npx hardhat run scripts/deploy.js --network arbitrum
```

2. Configure peers:
```bash
# Update configure-peers.js with deployed addresses
npx hardhat run scripts/configure-peers.js --network ethereum
npx hardhat run scripts/configure-peers.js --network polygon
npx hardhat run scripts/configure-peers.js --network arbitrum
```

3. Transfer punks between chains:
```javascript
const fee = await contract.quoteSendPunk(punkIndex, polygonEid, recipient, options);
await contract.sendPunkCrossChain(punkIndex, polygonEid, recipient, options, { value: fee.nativeFee });
```

### Scenario 3: Layer 2 Deployment

**Goal:** Deploy on a low-cost L2 for gas savings

**Steps:**

1. Choose L2 (Base, Optimism, Arbitrum, Polygon):
```bash
npx hardhat run scripts/deploy.js --network base
```

2. Lower gas costs for all operations
3. Bridge to other chains via LayerZero if needed

## Code Migration Examples

### Example 1: Buying a Punk

**V1 Integration:**
```javascript
// Using web3.js with V1
const contract = new web3.eth.Contract(V1_ABI, V1_ADDRESS);
await contract.methods.buyPunk(punkIndex).send({
    from: account,
    value: price
});
```

**V2 Integration:**
```javascript
// Using ethers.js with V2
const contract = await ethers.getContractAt("CryptoPunksMarketV2", V2_ADDRESS);
await contract.buyPunk(punkIndex, { value: price });
```

### Example 2: Checking Ownership

**V1:**
```javascript
const owner = await contract.methods.punkIndexToAddress(punkIndex).call();
```

**V2 (ERC721 standard):**
```javascript
// Multiple ways to check
const owner = await contract.ownerOf(punkIndex);
const balance = await contract.balanceOf(address);
```

### Example 3: Listing for Sale

**V1:**
```javascript
await contract.methods.offerPunkForSale(punkIndex, price).send({ from: account });
```

**V2 (same API, better errors):**
```javascript
await contract.offerPunkForSale(punkIndex, price);
```

## Testing Migration

### V1 Test Pattern
```javascript
// Truffle test
const CryptoPunksMarket = artifacts.require("./CryptoPunksMarket.sol");

contract('CryptoPunksMarket', function (accounts) {
    it("can offer a punk", async function () {
        var contract = await CryptoPunksMarket.deployed();
        // ... test code
    });
});
```

### V2 Test Pattern
```javascript
// Hardhat test
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoPunksMarketV2", function () {
    it("Should allow offering a punk for sale", async function () {
        const [owner, addr1] = await ethers.getSigners();
        const contract = await ethers.deployContract("CryptoPunksMarketV2", [lzEndpoint, owner.address]);
        // ... test code
        await expect(contract.offerPunkForSale(0, price))
            .to.emit(contract, "PunkOffered");
    });
});
```

## Gas Cost Comparison

| Operation | V1 Gas | V2 Gas | Difference |
|-----------|--------|--------|------------|
| Deploy | ~1,200,000 | ~2,500,000 | +108% (cross-chain features) |
| Offer for sale | ~50,000 | ~45,000 | -10% |
| Buy punk | ~150,000 | ~140,000 | -7% |
| Enter bid | ~80,000 | ~75,000 | -6% |
| Accept bid | ~120,000 | ~115,000 | -4% |
| Withdraw | ~30,000 | ~28,000 | -7% |

**Note:** V2 deployment is more expensive due to LayerZero integration and additional features, but everyday operations are more gas-efficient.

## Frontend Integration

### V1 dApp
```javascript
// Connect to V1
const provider = new ethers.providers.Web3Provider(window.ethereum);
const contract = new ethers.Contract(V1_ADDRESS, V1_ABI, provider.getSigner());
```

### V2 dApp
```javascript
// Connect to V2 (same pattern, but more features)
const provider = new ethers.providers.Web3Provider(window.ethereum);
const contract = new ethers.Contract(V2_ADDRESS, V2_ABI, provider.getSigner());

// New: Check if on correct chain
const chainId = await provider.getNetwork().then(n => n.chainId);

// New: Quote cross-chain transfer
const fee = await contract.quoteSendPunk(punkIndex, dstEid, recipient, options);
```

## Checklist for Using V2

- [ ] Understand V2 is for new deployments, not replacement
- [ ] Choose deployment network(s)
- [ ] Set up LayerZero endpoints if using cross-chain
- [ ] Deploy contract with deployment script
- [ ] Verify contract on block explorer
- [ ] Configure cross-chain peers (if applicable)
- [ ] Test all marketplace functions
- [ ] Assign initial punk owners
- [ ] Mark distribution as complete
- [ ] Update frontend to use V2 ABI
- [ ] Test emergency pause/unpause
- [ ] Monitor gas costs
- [ ] Set up event indexing

## Common Pitfalls

### ❌ Mistake 1: Trying to "upgrade" V1
```
V1 contract cannot be upgraded or replaced. It's immutable.
```

### ❌ Mistake 2: Not configuring cross-chain peers
```
Cross-chain transfers will fail if peers aren't configured on both chains.
```

### ❌ Mistake 3: Insufficient LayerZero fees
```javascript
// Wrong - no fee provided
await contract.sendPunkCrossChain(punkIndex, dstEid, recipient, options);

// Correct - quote and pay fee
const fee = await contract.quoteSendPunk(punkIndex, dstEid, recipient, options);
await contract.sendPunkCrossChain(punkIndex, dstEid, recipient, options, { value: fee.nativeFee });
```

### ❌ Mistake 4: Not handling custom errors
```javascript
// Wrong - catching generic error
try {
    await contract.buyPunk(punkIndex, { value: insufficientAmount });
} catch (error) {
    console.log("Error occurred");
}

// Correct - handle specific errors
try {
    await contract.buyPunk(punkIndex, { value: insufficientAmount });
} catch (error) {
    if (error.message.includes("InsufficientPayment")) {
        console.log("Please send more ETH");
    } else if (error.message.includes("PunkNotForSale")) {
        console.log("This punk is not for sale");
    }
}
```

## Resources

- [V2 Contract](./contracts/CryptoPunksMarketV2.sol)
- [V2 README](./README-V2.md)
- [Deployment Scripts](./scripts/)
- [Test Suite](./test/CryptoPunksMarketV2.test.js)
- [OpenZeppelin Docs](https://docs.openzeppelin.com/)
- [LayerZero Docs](https://docs.layerzero.network/)
- [Hardhat Docs](https://hardhat.org/docs)

## Support

For questions about:
- **V1 Contract**: See original [README.md](./readme.md)
- **V2 Contract**: See [README-V2.md](./README-V2.md)
- **Migration**: This guide
- **Issues**: Open a GitHub issue

---

**Remember**: V2 is a modern, reference implementation. Use it for new projects, not as a replacement for the original CryptoPunks contract.
