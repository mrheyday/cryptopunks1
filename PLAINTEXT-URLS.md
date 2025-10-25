# Plaintext Patch and Diff URLs

Quick reference for accessing Git changes in plaintext format via GitHub URLs.

---

## Commit 1: CryptoPunks V2 Modernization

**Commit Hash**: `1348c5604de5304d4ed0585210d1293c408dd621`
**Message**: feat: Add modernized CryptoPunks V2 with cross-chain support
**Changes**: 14 files changed, 2,960 insertions(+)

### URLs

**Patch Format** (Email-style with headers):
```
https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.patch
```

**Diff Format** (Standard unified diff):
```
https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.diff
```

**Web View**:
```
https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621
```

### Files Changed
- contracts/CryptoPunksMarketV2.sol (584 lines)
- contracts/mocks/MockLZEndpoint.sol (39 lines)
- test/CryptoPunksMarketV2.test.js (491 lines)
- scripts/deploy.js (131 lines)
- scripts/configure-peers.js (132 lines)
- hardhat.config.js (130 lines)
- package-v2.json (49 lines)
- README-V2.md (470 lines)
- MIGRATION-GUIDE.md (411 lines)
- IMPROVEMENTS-SUMMARY.md (369 lines)
- .env.example (47 lines)
- .gitignore (59 lines)
- .solhint.json (23 lines)
- .prettierrc.json (25 lines)

---

## Commit 2: Patch/Diff Documentation

**Commit Hash**: `4194e5d` (full: `4194e5d...`)
**Message**: docs: Add patch and diff files for modernization changes
**Changes**: 4 files changed, 6,482 insertions(+)

### URLs

**Patch Format**:
```
https://github.com/mrheyday/cryptopunks1/commit/4194e5d.patch
```

**Diff Format**:
```
https://github.com/mrheyday/cryptopunks1/commit/4194e5d.diff
```

### Files Added
- modernization.patch (104K)
- modernization.diff (98K)
- PATCH-AND-DIFF-GUIDE.md
- changes-summary.txt

---

## Branch Comparison

Compare all changes in the branch against main:

**Patch Format**:
```
https://github.com/mrheyday/cryptopunks1/compare/main...claude/code-quality-check-011CUSnvEAXqDbUaPA97jSoe.patch
```

**Diff Format**:
```
https://github.com/mrheyday/cryptopunks1/compare/main...claude/code-quality-check-011CUSnvEAXqDbUaPA97jSoe.diff
```

**Web View**:
```
https://github.com/mrheyday/cryptopunks1/compare/main...claude/code-quality-check-011CUSnvEAXqDbUaPA97jSoe
```

---

## Pull Request (Once Created)

After creating a pull request, you can access:

**Patch Format**:
```
https://github.com/mrheyday/cryptopunks1/pull/{PR_NUMBER}.patch
```

**Diff Format**:
```
https://github.com/mrheyday/cryptopunks1/pull/{PR_NUMBER}.diff
```

---

## Local Files

The following files are also available in the repository:

```bash
./modernization.patch      # 104K - Full patch for commit 1348c56
./modernization.diff       # 98K  - Full diff for commit 1348c56
./changes-summary.txt      # Quick statistics
./PATCH-AND-DIFF-GUIDE.md  # Detailed guide
```

---

## Download Examples

### Using curl
```bash
# Download the main modernization patch
curl -O https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.patch

# Download the main modernization diff
curl -O https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.diff

# Download branch comparison
curl -O https://github.com/mrheyday/cryptopunks1/compare/main...claude/code-quality-check-011CUSnvEAXqDbUaPA97jSoe.patch
```

### Using wget
```bash
wget https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.patch
wget https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.diff
```

### Using Git
```bash
# Clone and checkout the branch
git clone https://github.com/mrheyday/cryptopunks1.git
cd cryptopunks1
git checkout claude/code-quality-check-011CUSnvEAXqDbUaPA97jSoe

# The patch files are already in the repository
cat modernization.patch
cat modernization.diff
```

---

## Apply Changes

### Method 1: Git Apply
```bash
# Download patch
curl -O https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.patch

# Apply to your repository
git apply 1348c5604de5304d4ed0585210d1293c408dd621.patch
```

### Method 2: Git AM (Preserves Commit Info)
```bash
# Download patch
curl https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.patch | git am
```

### Method 3: Patch Command
```bash
# Download diff
curl -O https://github.com/mrheyday/cryptopunks1/commit/1348c5604de5304d4ed0585210d1293c408dd621.diff

# Apply with patch
patch -p1 < 1348c5604de5304d4ed0585210d1293c408dd621.diff
```

---

## Quick Stats

### Commit 1348c56
```
14 files changed
2,960 insertions(+)
0 deletions(-)
```

### Commit 4194e5d
```
4 files changed
6,482 insertions(+)
0 deletions(-)
```

### Total Branch Changes
```
18 files changed
9,442 insertions(+)
0 deletions(-)
```

---

## GitHub API Access

You can also access commit diffs via the GitHub API:

```bash
# Get commit details
curl https://api.github.com/repos/mrheyday/cryptopunks1/commits/1348c5604de5304d4ed0585210d1293c408dd621

# Get diff
curl -H "Accept: application/vnd.github.v3.diff" \
  https://api.github.com/repos/mrheyday/cryptopunks1/commits/1348c5604de5304d4ed0585210d1293c408dd621

# Get patch
curl -H "Accept: application/vnd.github.v3.patch" \
  https://api.github.com/repos/mrheyday/cryptopunks1/commits/1348c5604de5304d4ed0585210d1293c408dd621
```

---

## Summary

All modernization changes are available in **plaintext format** via:

1. ✅ **GitHub URLs** - Append `.patch` or `.diff` to any commit or PR URL
2. ✅ **Local files** - `modernization.patch` and `modernization.diff` in repository
3. ✅ **GitHub API** - Use Accept headers for diff/patch format
4. ✅ **Git commands** - `git show`, `git diff`, `git format-patch`

**Branch**: `claude/code-quality-check-011CUSnvEAXqDbUaPA97jSoe`
**Repository**: `https://github.com/mrheyday/cryptopunks1`
**Total Changes**: 18 files, 9,442+ lines of improvements
