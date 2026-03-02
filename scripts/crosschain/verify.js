/**
 * @file verify.js
 * @description Verify that LayerZero peers are correctly configured on all chains.
 *
 * Usage:
 *   npx hardhat run scripts/crosschain/verify.js --network sepolia
 *
 * Environment variables:
 *   LOCAL_CONTRACT_ADDRESS           - Contract on the current network
 *   PEER_<CHAIN>_CONTRACT_ADDRESS    - Contract address deployed on <CHAIN>
 *     e.g. PEER_BASESEPOLIA_CONTRACT_ADDRESS=0x…
 */

"use strict";

const { ethers }                   = require("hardhat");
const { CHAIN_EIDS, isTestnet }    = require("./constants");

// ─── ABI Fragments ────────────────────────────────────────────────────────────
const VERIFY_ABI = [
  "function getPeer(uint32 eid) view returns (bytes32)",
  "function hasPeer(uint32 eid) view returns (bool)",
  "function addressToBytes32(address addr) pure returns (bytes32)",
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
];

// ─── Core verification logic ──────────────────────────────────────────────────

/**
 * Check whether a contract has a peer set for a given remote chain,
 * and verify it matches the expected address.
 *
 * @param {object}   opts
 * @param {string}   opts.contractAddress    Local contract
 * @param {string}   opts.remoteChain        Remote chain name
 * @param {string}   opts.expectedAddress    Expected remote contract address
 * @returns {Promise<{ok: boolean, configured: string, expected: string}>}
 */
async function verifyPeer(opts) {
  const { contractAddress, remoteChain, expectedAddress } = opts;

  const dstEid   = CHAIN_EIDS[remoteChain];
  if (!dstEid) throw new Error(`Unknown chain: ${remoteChain}`);

  const contract = new ethers.Contract(contractAddress, VERIFY_ABI, ethers.provider);
  const has      = await contract.hasPeer(dstEid);

  if (!has) {
    return { ok: false, configured: "(none)", expected: expectedAddress };
  }

  const configured = await contract.getPeer(dstEid);
  const expected32 = await contract.addressToBytes32(expectedAddress);
  const ok         = configured.toLowerCase() === expected32.toLowerCase();

  return {
    ok,
    configured: "0x" + configured.slice(26), // extract address portion
    expected:   expectedAddress,
  };
}

/**
 * Verify all peers configured via environment variables.
 *
 * For each PEER_<CHAIN>_CONTRACT_ADDRESS env var, checks that the local
 * contract has the correct peer set.
 *
 * @param {string} contractAddress  Local contract address
 * @returns {Promise<{chain: string, ok: boolean, configured: string, expected: string}[]>}
 */
async function verifyAllPeers(contractAddress) {
  const results = [];

  for (const [envKey, value] of Object.entries(process.env)) {
    const match = envKey.match(/^PEER_(\w+)_CONTRACT_ADDRESS$/i);
    if (!match || !value) continue;

    const chain = match[1].toLowerCase();
    // Normalize chain name (e.g. "basesepolia" → "baseSepolia")
    const normalizedChain = Object.keys(CHAIN_EIDS).find(
      (k) => k.toLowerCase() === chain
    );

    if (!normalizedChain) {
      results.push({ chain, ok: false, configured: "n/a", expected: value, error: "Unknown chain" });
      continue;
    }

    try {
      const result = await verifyPeer({ contractAddress, remoteChain: normalizedChain, expectedAddress: value });
      results.push({ chain: normalizedChain, ...result });
    } catch (err) {
      results.push({ chain: normalizedChain, ok: false, configured: "error", expected: value, error: err.message });
    }
  }

  return results;
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const contractAddress = process.env.LOCAL_CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("Set LOCAL_CONTRACT_ADDRESS in .env");
    process.exit(1);
  }

  const network = (await ethers.provider.getNetwork()).name;
  const testnet = isTestnet(network);
  const contract = new ethers.Contract(contractAddress, VERIFY_ABI, ethers.provider);

  console.log();
  console.log("=".repeat(60));
  console.log("  LayerZero Peer Verification");
  console.log("=".repeat(60));
  console.log(`  Network  : ${network} ${testnet ? "(testnet)" : "(mainnet)"}`);
  console.log(`  Contract : ${contractAddress}`);
  console.log(`  Paused   : ${await contract.paused()}`);
  console.log(`  Owner    : ${await contract.owner()}`);
  console.log("=".repeat(60));

  const results = await verifyAllPeers(contractAddress);

  if (results.length === 0) {
    console.log();
    console.log("  No PEER_*_CONTRACT_ADDRESS env vars found.");
    console.log("  Add them to .env, e.g.:");
    console.log("    PEER_BASESEPOLIA_CONTRACT_ADDRESS=0x…");
    console.log("    PEER_ARBITRUMSEPOLIA_CONTRACT_ADDRESS=0x…");
    console.log();
    return;
  }

  let allOk = true;
  console.log();
  for (const r of results) {
    const icon = r.ok ? "OK " : "FAIL";
    console.log(`  [${icon}] ${r.chain}`);
    console.log(`       Configured : ${r.configured}`);
    console.log(`       Expected   : ${r.expected}`);
    if (r.error) console.log(`       Error      : ${r.error}`);
    if (!r.ok) allOk = false;
    console.log();
  }

  console.log("=".repeat(60));
  console.log(`  Result: ${allOk ? "All peers verified" : "Some peers missing or incorrect"}`);
  console.log("=".repeat(60));
  console.log();

  if (!allOk) process.exit(1);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { verifyPeer, verifyAllPeers };
