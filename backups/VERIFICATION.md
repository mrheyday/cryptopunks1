# CryptoPunks Media and Metadata Verification Guide

This directory contains verified backups of all CryptoPunks media files, contract metadata, and verification information.

---

## 📁 Directory Structure

```
backups/
├── media/                    # Image files
│   ├── punks.png            # All 10,000 CryptoPunks (829K)
│   └── punk-variety.png     # Variety showcase (6.5K)
├── metadata/                 # Contract metadata
│   └── CryptoPunksMarket.abi # Contract ABI (5.8K)
├── contracts/                # Contract source code backups
│   ├── CryptoPunksMarket.sol    # Original V1 contract
│   └── CryptoPunksMarketV2.sol  # Modernized V2 contract
└── VERIFICATION.md          # This file
```

---

## ✅ File Verification

### SHA256 Checksums

All files have been verified with SHA256 checksums:

```
ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b  media/punks.png
84fa1f7ae9710e668a26c9f035bbc1f801b5ff6410750041e656a0f59e4260aa  media/punk-variety.png
7bad511c7dbb18f60fce65efab1052e18ab169c91c6da8c2fb57f29060e3335c  metadata/CryptoPunksMarket.abi
```

### Verify Files

You can verify the integrity of these files using:

```bash
# From the backups directory
sha256sum -c checksums.txt

# Or verify individual files
sha256sum media/punks.png
sha256sum media/punk-variety.png
sha256sum metadata/CryptoPunksMarket.abi
```

---

## 🖼️ Media Files

### punks.png (829K)
- **Description**: Official image containing all 10,000 unique CryptoPunks
- **Dimensions**: 10000 punks arranged in a grid
- **Format**: PNG
- **SHA256**: `ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b`
- **Verification**: ✅ **MATCHES CONTRACT HASH**

#### Contract Verification

The CryptoPunksMarket contract (at `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB`) contains an embedded hash:

```solidity
// Line 5 in CryptoPunksMarket.sol
string public imageHash = "ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b";
```

This hash **exactly matches** the SHA256 hash of `punks.png`, proving this is the authentic, official image.

#### How to Verify

```bash
# Calculate the hash
sha256sum punks.png

# Expected output:
# ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b  punks.png

# Or using OpenSSL (as mentioned in readme)
openssl sha -sha256 punks.png
```

### punk-variety.png (6.5K)
- **Description**: Showcase image displaying variety of punk types
- **Format**: PNG
- **SHA256**: `84fa1f7ae9710e668a26c9f035bbc1f801b5ff6410750041e656a0f59e4260aa`
- **Usage**: Marketing/promotional material

---

## 📄 Metadata Files

### CryptoPunksMarket.abi (5.8K)
- **Description**: Application Binary Interface for the CryptoPunks contract
- **Format**: JSON
- **SHA256**: `7bad511c7dbb18f60fce65efab1052e18ab169c91c6da8c2fb57f29060e3335c`
- **Usage**: Required for interacting with the contract at `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB`

#### ABI Contents

The ABI defines the following contract interface:

**Functions:**
- `setInitialOwner(address, uint256)`
- `setInitialOwners(address[], uint256[])`
- `allInitialOwnersAssigned()`
- `getPunk(uint256)`
- `transferPunk(address, uint256)`
- `offerPunkForSale(uint256, uint256)`
- `offerPunkForSaleToAddress(uint256, uint256, address)`
- `buyPunk(uint256)` - payable
- `punkNoLongerForSale(uint256)`
- `enterBidForPunk(uint256)` - payable
- `acceptBidForPunk(uint256, uint256)`
- `withdrawBidForPunk(uint256)`
- `withdraw()`

**Events:**
- `Assign(address indexed to, uint256 punkIndex)`
- `Transfer(address indexed from, address indexed to, uint256 value)`
- `PunkTransfer(address indexed from, address indexed to, uint256 punkIndex)`
- `PunkOffered(uint256 indexed punkIndex, uint256 minValue, address indexed toAddress)`
- `PunkBidEntered(uint256 indexed punkIndex, uint256 value, address indexed fromAddress)`
- `PunkBidWithdrawn(uint256 indexed punkIndex, uint256 value, address indexed fromAddress)`
- `PunkBought(uint256 indexed punkIndex, uint256 value, address indexed fromAddress, address indexed toAddress)`
- `PunkNoLongerForSale(uint256 indexed punkIndex)`

#### Usage Example

```javascript
// Using ethers.js
const abi = require('./backups/metadata/CryptoPunksMarket.abi');
const contract = new ethers.Contract(
    '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB',
    abi,
    provider
);

// Read punk owner
const owner = await contract.punkIndexToAddress(0);

// Get punk offer
const offer = await contract.punksOfferedForSale(0);
```

---

## 💾 Contract Source Code

### CryptoPunksMarket.sol (V1)
- **Description**: Original CryptoPunks marketplace contract
- **Solidity Version**: 0.4.8
- **Deployed At**: `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB` (Ethereum Mainnet)
- **Status**: Live and immutable
- **Lines**: 246

### CryptoPunksMarketV2.sol
- **Description**: Modernized version with cross-chain support
- **Solidity Version**: 0.8.20
- **Status**: Reference implementation (not deployed to replace V1)
- **Lines**: 700+
- **Features**: ERC721, LayerZero, OpenZeppelin security

---

## 🔒 Authenticity Verification

### Step-by-Step Verification Process

#### 1. Verify punks.png is authentic

```bash
# Calculate hash
sha256sum backups/media/punks.png

# Expected output:
# ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b

# Compare with contract
# View contract at: https://etherscan.io/address/0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB#code
# Check imageHash variable (line 5)
```

#### 2. Verify contract ABI

```bash
# The ABI should match the contract interface
# You can verify by comparing with:
# https://etherscan.io/address/0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB#code

# Or download from Etherscan and compare:
curl "https://api.etherscan.io/api?module=contract&action=getabi&address=0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB" | jq -r .result > etherscan-abi.json
diff etherscan-abi.json backups/metadata/CryptoPunksMarket.abi
```

#### 3. Verify contract source code

```bash
# Compare with verified source on Etherscan
# https://etherscan.io/address/0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB#code

# The source code should be identical to CryptoPunksMarket.sol
```

---

## 📊 File Inventory

| File | Type | Size | SHA256 | Verified |
|------|------|------|--------|----------|
| punks.png | Image | 829K | ac39af...2921b | ✅ Matches contract |
| punk-variety.png | Image | 6.5K | 84fa1f...260aa | ✅ Original file |
| CryptoPunksMarket.abi | JSON | 5.8K | 7bad51...3335c | ✅ Contract ABI |
| CryptoPunksMarket.sol | Solidity | ~7K | - | ✅ V1 source |
| CryptoPunksMarketV2.sol | Solidity | ~30K | - | ✅ V2 source |

---

## 🌐 External References

### Official Links
- **Website**: https://www.larvalabs.com/cryptopunks
- **Contract**: https://etherscan.io/address/0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB
- **OpenSea**: https://opensea.io/collection/cryptopunks

### Verification Tools
- **Etherscan**: Contract verification and ABI download
- **IPFS**: Decentralized image storage (if available)
- **SHA256**: Standard cryptographic hash function

---

## 🔄 Backup History

| Date | Action | Files | Hash Verified |
|------|--------|-------|---------------|
| 2025-10-25 | Initial backup | All media/metadata | ✅ Yes |
| 2025-10-25 | Added V2 contract | CryptoPunksMarketV2.sol | ✅ Yes |

---

## 📝 Usage Notes

### Restoring Files

If you need to restore files from this backup:

```bash
# Restore media files
cp backups/media/*.png ./

# Restore metadata
cp backups/metadata/*.abi compiled/

# Restore contracts
cp backups/contracts/*.sol contracts/
```

### Verifying After Restore

```bash
# Generate checksums
sha256sum punks.png punk-variety.png compiled/CryptoPunksMarket.abi

# Compare with checksums in this document
```

---

## ⚠️ Important Notes

1. **punks.png Hash is Critical**: The image hash embedded in the smart contract is the ultimate proof of authenticity. Always verify this hash.

2. **Contract is Immutable**: The deployed contract at `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB` cannot be changed. These files represent the permanent, official CryptoPunks.

3. **V2 is Not a Replacement**: CryptoPunksMarketV2.sol is a modernized reference implementation and does not replace the original contract.

4. **Keep Multiple Backups**: Store copies in multiple locations (local, cloud, IPFS) for redundancy.

5. **Verify Before Use**: Always verify file hashes before using these files in production.

---

## 🔐 Security Recommendations

1. ✅ Store backups in multiple locations
2. ✅ Verify SHA256 hashes after any file transfer
3. ✅ Keep offline copies for disaster recovery
4. ✅ Use version control (Git) for contract source code
5. ✅ Compare with official Etherscan sources periodically
6. ✅ Maintain detailed verification logs

---

**Backup Created**: 2025-10-25
**Verified By**: Automated verification scripts
**Next Verification**: As needed
**Status**: ✅ All files verified and backed up
