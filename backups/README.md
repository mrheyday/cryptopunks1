# CryptoPunks Backups

Complete backup of all CryptoPunks media files, contract metadata, and verification data.

---

## 🎯 Quick Start

### Verify All Files

```bash
cd backups
sha256sum -c checksums.txt
```

Expected output:
```
media/punks.png: OK
media/punk-variety.png: OK
metadata/CryptoPunksMarket.abi: OK
contracts/CryptoPunksMarket.sol: OK
contracts/CryptoPunksMarketV2.sol: OK
```

### Verify Critical Image

```bash
sha256sum media/punks.png
```

Expected: `ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b`

This **MUST** match the `imageHash` variable in the smart contract.

---

## 📁 Contents

```
backups/
├── README.md                    # This file - Quick start guide
├── VERIFICATION.md              # Complete verification guide
├── checksums.txt                # SHA256 checksums for all files
├── media/                       # Image files
│   ├── punks.png               # ✅ Verified - All 10,000 punks (829K)
│   └── punk-variety.png        # Variety showcase (6.5K)
├── metadata/                    # Contract metadata
│   └── CryptoPunksMarket.abi   # Contract ABI (5.8K)
└── contracts/                   # Source code backups
    ├── CryptoPunksMarket.sol   # Original V1 contract
    └── CryptoPunksMarketV2.sol # Modernized V2 contract
```

---

## ✅ Verification Status

| File | Status | Hash Match |
|------|--------|------------|
| punks.png | ✅ Verified | ✅ Matches contract hash |
| punk-variety.png | ✅ Verified | ✅ Original file |
| CryptoPunksMarket.abi | ✅ Verified | ✅ Contract interface |
| CryptoPunksMarket.sol | ✅ Verified | ✅ V1 source |
| CryptoPunksMarketV2.sol | ✅ Verified | ✅ V2 source |

---

## 🔒 Critical Verification

The most important file is **punks.png**. Its SHA256 hash is embedded in the Ethereum smart contract:

**Contract Address**: `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB`
**Image Hash (from contract)**: `ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b`
**File Hash (computed)**: `ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b`

**Status**: ✅ **VERIFIED - HASHES MATCH**

This proves the authenticity of the image file.

---

## 📖 Documentation

- **VERIFICATION.md** - Complete verification guide with step-by-step instructions
- **checksums.txt** - SHA256 checksums for automated verification
- **README.md** - This quick start guide

---

## 🚀 Common Tasks

### Extract All Files

```bash
# Copy all backed up files back to repository root
cp backups/media/*.png ./
cp backups/metadata/*.abi compiled/
cp backups/contracts/*.sol contracts/
```

### Verify Image Authenticity

```bash
# Method 1: Using sha256sum
sha256sum backups/media/punks.png

# Method 2: Using openssl (as per original readme)
openssl sha -sha256 backups/media/punks.png

# Compare with contract imageHash:
# https://etherscan.io/address/0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB#readContract
```

### Use ABI in Your Application

```javascript
const fs = require('fs');
const ethers = require('ethers');

// Load ABI
const abi = JSON.parse(fs.readFileSync('backups/metadata/CryptoPunksMarket.abi'));

// Connect to contract
const contract = new ethers.Contract(
    '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB',
    abi,
    provider
);

// Query contract
const imageHash = await contract.imageHash();
console.log('Contract Image Hash:', imageHash);
// Expected: ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b
```

---

## 📊 File Details

### Media Files

**punks.png** (829,224 bytes)
- All 10,000 unique CryptoPunks in one image
- SHA256: `ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b`
- **Critical**: Hash matches contract - VERIFIED ✅

**punk-variety.png** (6,656 bytes)
- Showcase of punk variety/types
- SHA256: `84fa1f7ae9710e668a26c9f035bbc1f801b5ff6410750041e656a0f59e4260aa`
- Used for marketing/promotional purposes

### Metadata Files

**CryptoPunksMarket.abi** (5,918 bytes)
- JSON ABI for contract interaction
- SHA256: `7bad511c7dbb18f60fce65efab1052e18ab169c91c6da8c2fb57f29060e3335c`
- Required for Web3/ethers.js integration

### Contract Files

**CryptoPunksMarket.sol**
- Original Solidity 0.4.8 contract
- Deployed at 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB
- Historic, immutable implementation

**CryptoPunksMarketV2.sol**
- Modern Solidity 0.8.20 implementation
- Includes ERC721, cross-chain support
- Reference implementation (not deployed)

---

## 🔐 Security Notes

1. **Always verify checksums** before using backed up files
2. **Compare with Etherscan** for contract source verification
3. **Keep multiple copies** in different locations
4. **Critical hash**: punks.png must always match contract imageHash
5. **Never modify** these backup files - create copies if you need to work with them

---

## 🌐 Official Resources

- **CryptoPunks Website**: https://www.larvalabs.com/cryptopunks
- **Etherscan Contract**: https://etherscan.io/address/0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB
- **Contract Code**: https://etherscan.io/address/0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB#code

---

## 📅 Backup Information

- **Created**: 2025-10-25
- **Repository**: cryptopunks1
- **Branch**: claude/code-quality-check-011CUSnvEAXqDbUaPA97jSoe
- **Files Backed Up**: 5 files (media, metadata, contracts)
- **Total Size**: ~870 KB
- **Verification**: ✅ All files verified with SHA256

---

## ⚡ Quick Commands

```bash
# Verify everything
sha256sum -c backups/checksums.txt

# Verify critical image only
sha256sum backups/media/punks.png | grep ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b

# List all files
find backups -type f -exec ls -lh {} \;

# View checksums
cat backups/checksums.txt

# Create new backup
tar -czf cryptopunks-backup-$(date +%Y%m%d).tar.gz backups/
```

---

**Status**: ✅ All files backed up and verified
**Next Action**: Store in multiple locations for redundancy
