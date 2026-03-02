/**
 * @file send.js
 * @description Execute a LayerZero V2 cross-chain NFT transfer.
 *
 * Usage:
 *   npx hardhat run scripts/crosschain/send.js --network sepolia
 *
 * Environment variables:
 *   LOCAL_CONTRACT_ADDRESS - Source chain contract
 *   DST_CHAIN              - Destination chain name (e.g. "baseSepolia")
 *   TOKEN_ID               - Token ID to send
 *   RECEIVER               - Recipient address on destination chain
 *   MSG_VALUE              - ETH to attach (get from quote.js; leave blank to auto-quote)
 *   DRY_RUN                - "true" to simulate without broadcasting
 */

"use strict";

const { ethers }                              = require("hardhat");
const { getEid, isTestnet, explorerTxLink,
        lzScanLink, NATIVE_TOKEN }            = require("./constants");
const { quoteSingleSend }                     = require("./quote");

// ─── ABI Fragments ────────────────────────────────────────────────────────────
const SEND_ABI = [
  "function quoteSend(uint32 dstEid, uint256 tokenId, address receiver, bool withBuffer) view returns (uint256 nativeFee)",
  "function sendPunkCrossChain(uint32 dstEid, uint256 tokenId, address receiver, bytes calldata options) payable returns (bytes32 guid)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function hasPeer(uint32 eid) view returns (bool)",
  "function encodeGasOption(uint128 gasLimit) pure returns (bytes)",
  "function paused() view returns (bool)",
];

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Send one NFT cross-chain via LayerZero V2.
 *
 * @param {object} opts
 * @param {string}   opts.contractAddress  Source chain contract
 * @param {string}   opts.dstChain         Destination chain name
 * @param {number}   opts.tokenId          Token ID
 * @param {string}   opts.receiver         Recipient address on destination
 * @param {bigint}   [opts.msgValue]       Override auto-quoted fee (wei)
 * @param {boolean}  [opts.dryRun]         Simulate only, do not broadcast
 * @returns {Promise<{txHash: string, guid: string, fee: string}>}
 */
async function sendCrossChain(opts) {
  const { contractAddress, dstChain, tokenId, receiver, dryRun = false } = opts;

  const [signer]  = await ethers.getSigners();
  const network   = (await ethers.provider.getNetwork()).name;
  const testnet   = isTestnet(network);
  const dstEid    = getEid(dstChain);
  const symbol    = NATIVE_TOKEN[network] ?? "ETH";
  const contract  = new ethers.Contract(contractAddress, SEND_ABI, signer);

  // ── Pre-flight checks ──────────────────────────────────────────────────────
  const [isPaused, hasPeer, currentOwner] = await Promise.all([
    contract.paused(),
    contract.hasPeer(dstEid),
    contract.ownerOf(tokenId),
  ]);

  if (isPaused)              throw new Error("Contract is paused");
  if (!hasPeer)              throw new Error(`No peer configured for ${dstChain} (eID ${dstEid})`);
  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Token #${tokenId} not owned by signer (owner: ${currentOwner})`);
  }

  // ── Build options bytes ────────────────────────────────────────────────────
  const GAS_LIMIT = 200_000n;
  const options   = await contract.encodeGasOption(GAS_LIMIT);

  // ── Get fee ────────────────────────────────────────────────────────────────
  let msgValue = opts.msgValue;
  if (!msgValue) {
    const quoted = await quoteSingleSend({ contractAddress, dstChain, tokenId, receiver, withBuffer: true });
    msgValue = quoted.nativeFee;
  }

  console.log();
  console.log("=".repeat(56));
  console.log("  Cross-Chain Send");
  console.log("=".repeat(56));
  console.log(`  Token ID   : #${tokenId}`);
  console.log(`  From       : ${signer.address} (${network})`);
  console.log(`  To         : ${receiver} (${dstChain})`);
  console.log(`  Fee        : ${ethers.formatEther(msgValue)} ${symbol}`);
  console.log(`  Dry run    : ${dryRun}`);
  console.log("=".repeat(56));

  if (dryRun) {
    console.log("  [DRY RUN] Transaction not broadcast.");
    return { txHash: null, guid: null, fee: ethers.formatEther(msgValue) };
  }

  // ── Execute ────────────────────────────────────────────────────────────────
  const tx = await contract.sendPunkCrossChain(
    dstEid,
    tokenId,
    receiver,
    options,
    { value: msgValue }
  );

  console.log(`  TX hash    : ${tx.hash}`);
  console.log(`  Explorer   : ${explorerTxLink(network, tx.hash)}`);
  console.log(`  LZ Scan    : ${lzScanLink(tx.hash, testnet)}`);
  console.log("  Waiting for confirmation…");

  const receipt = await tx.wait();

  // ── Parse GUID from CrossChainSent event ──────────────────────────────────
  const sentEvent = receipt.logs
    .map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === "CrossChainSent");

  const guid = sentEvent?.args?.guid ?? "(check LZ Scan)";

  console.log(`  Confirmed  : block ${receipt.blockNumber}`);
  console.log(`  GUID       : ${guid}`);
  console.log("=".repeat(56));
  console.log();
  console.log("  Track delivery:");
  console.log(`    ${lzScanLink(tx.hash, testnet)}`);
  console.log();

  return { txHash: tx.hash, guid, fee: ethers.formatEther(msgValue) };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const contractAddress = process.env.LOCAL_CONTRACT_ADDRESS;
  const dstChain        = process.env.DST_CHAIN;
  const tokenId         = Number(process.env.TOKEN_ID);
  const receiver        = process.env.RECEIVER;
  const dryRun          = process.env.DRY_RUN === "true";
  const msgValueStr     = process.env.MSG_VALUE;
  const msgValue        = msgValueStr ? ethers.parseEther(msgValueStr) : undefined;

  if (!contractAddress || !dstChain || !tokenId || !receiver) {
    console.error("Missing env vars: LOCAL_CONTRACT_ADDRESS, DST_CHAIN, TOKEN_ID, RECEIVER");
    process.exit(1);
  }

  await sendCrossChain({ contractAddress, dstChain, tokenId, receiver, msgValue, dryRun });
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { sendCrossChain };
