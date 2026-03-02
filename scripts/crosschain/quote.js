/**
 * @file quote.js
 * @description Quote LayerZero cross-chain send fees before executing a transfer.
 *
 * Usage:
 *   npx hardhat run scripts/crosschain/quote.js --network sepolia
 *
 * Environment variables required:
 *   LOCAL_CONTRACT_ADDRESS  - Deployed contract on the source chain
 *   DST_CHAIN               - Destination chain name (e.g. "baseSepolia")
 *   TOKEN_ID                - Token ID to quote
 *   RECEIVER                - Recipient address on the destination chain
 */

"use strict";

const { ethers }                           = require("hardhat");
const { getEid, isTestnet, NATIVE_TOKEN }  = require("./constants");

// ─── ABI Fragments ────────────────────────────────────────────────────────────
// Only the view functions needed for quoting — no full ABI required.
const QUOTE_ABI = [
  "function quoteSend(uint32 dstEid, uint256 tokenId, address receiver, bool withBuffer) view returns (uint256 nativeFee)",
  "function quoteBatchSend(uint32 dstEid, uint256[] tokenIds, address receiver) view returns (uint256 nativeFee)",
  "function addFeeBuffer(uint256 quotedFee, uint256 bps) pure returns (uint256)",
];

// ─── Quote a single token ──────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}   opts.contractAddress  Source chain contract
 * @param {string}   opts.dstChain         Destination chain name
 * @param {string}   opts.tokenId          Token ID (string or number)
 * @param {string}   opts.receiver         Recipient address
 * @param {boolean}  [opts.withBuffer]     Include 5% safety buffer (default: true)
 * @param {object}   [opts.provider]       ethers provider (defaults to hardhat)
 * @returns {Promise<{nativeFee: bigint, formatted: string, symbol: string}>}
 */
async function quoteSingleSend(opts) {
  const { contractAddress, dstChain, tokenId, receiver, withBuffer = true } = opts;

  const dstEid = getEid(dstChain);
  const network = (await ethers.provider.getNetwork()).name;
  const symbol  = NATIVE_TOKEN[network] ?? "ETH";

  const contract = new ethers.Contract(contractAddress, QUOTE_ABI, ethers.provider);
  const nativeFee = await contract.quoteSend(dstEid, tokenId, receiver, withBuffer);

  return {
    nativeFee,
    formatted: ethers.formatEther(nativeFee),
    symbol,
  };
}

/**
 * Quote fees for a batch of tokens.
 * @param {object} opts
 * @param {string}   opts.contractAddress
 * @param {string}   opts.dstChain
 * @param {number[]} opts.tokenIds
 * @param {string}   opts.receiver
 * @returns {Promise<{nativeFee: bigint, formatted: string, symbol: string, perToken: string}>}
 */
async function quoteBatchSend(opts) {
  const { contractAddress, dstChain, tokenIds, receiver } = opts;

  const dstEid  = getEid(dstChain);
  const network = (await ethers.provider.getNetwork()).name;
  const symbol  = NATIVE_TOKEN[network] ?? "ETH";

  const contract  = new ethers.Contract(contractAddress, QUOTE_ABI, ethers.provider);
  const nativeFee = await contract.quoteBatchSend(dstEid, tokenIds, receiver);

  return {
    nativeFee,
    formatted: ethers.formatEther(nativeFee),
    perToken:  ethers.formatEther(nativeFee / BigInt(tokenIds.length)),
    symbol,
  };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const contractAddress = process.env.LOCAL_CONTRACT_ADDRESS;
  const dstChain        = process.env.DST_CHAIN;
  const tokenId         = process.env.TOKEN_ID;
  const receiver        = process.env.RECEIVER;

  if (!contractAddress || !dstChain || !tokenId || !receiver) {
    console.error("Missing env vars: LOCAL_CONTRACT_ADDRESS, DST_CHAIN, TOKEN_ID, RECEIVER");
    process.exit(1);
  }

  const network = (await ethers.provider.getNetwork()).name;
  const testnet = isTestnet(network);

  console.log("=".repeat(56));
  console.log("  LayerZero Fee Quote");
  console.log("=".repeat(56));
  console.log(`  Source chain   : ${network}`);
  console.log(`  Destination    : ${dstChain} (eID ${getEid(dstChain)})`);
  console.log(`  Token ID       : #${tokenId}`);
  console.log(`  Receiver       : ${receiver}`);
  console.log(`  Mode           : ${testnet ? "testnet" : "mainnet"}`);
  console.log("=".repeat(56));

  // Quote without buffer
  const raw = await quoteSingleSend({ contractAddress, dstChain, tokenId, receiver, withBuffer: false });
  // Quote with buffer
  const buf = await quoteSingleSend({ contractAddress, dstChain, tokenId, receiver, withBuffer: true });

  console.log(`  Raw fee        : ${raw.formatted} ${raw.symbol}`);
  console.log(`  Fee +5% buffer : ${buf.formatted} ${buf.symbol}  <-- use as msg.value`);
  console.log("=".repeat(56));
  console.log();
  console.log("  To send the token run:");
  console.log(`    TOKEN_ID=${tokenId} RECEIVER=${receiver} DST_CHAIN=${dstChain} \\`);
  console.log(`    MSG_VALUE=${buf.formatted} npx hardhat run scripts/crosschain/send.js --network ${network}`);
  console.log();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { quoteSingleSend, quoteBatchSend };
