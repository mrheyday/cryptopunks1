/**
 * @file monitor.js
 * @description Poll LayerZero Scan to monitor cross-chain message delivery.
 *
 * Usage:
 *   npx hardhat run scripts/crosschain/monitor.js --network sepolia
 *
 * Environment variables:
 *   TX_HASH     - Source chain transaction hash to monitor
 *   POLL_MS     - Poll interval in ms (default: 10000)
 *   TIMEOUT_MS  - Max wait time in ms   (default: 300000 = 5 min)
 */

"use strict";

const { ethers }               = require("hardhat");
const { isTestnet, LZ_SCAN,
        explorerTxLink }        = require("./constants");

// ─── LayerZero Scan API ───────────────────────────────────────────────────────

/**
 * Fetch message status from LayerZero Scan.
 * @param {string}  txHash   Source chain tx hash
 * @param {boolean} testnet  true for testnet endpoint
 * @returns {Promise<object|null>}  LZ Scan message object or null on 404
 */
async function fetchLZStatus(txHash, testnet) {
  const base = testnet ? LZ_SCAN.testnet : LZ_SCAN.mainnet;
  const url  = `${base}/api/messages/tx/${txHash}`;

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LZ Scan API error: ${res.status}`);

  const json = await res.json();
  return json?.data?.[0] ?? null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS = {
  INFLIGHT:   "In Flight",
  DELIVERED:  "Delivered",
  FAILED:     "Failed",
  BLOCKED:    "Blocked",
  CONFIRMING: "Confirming",
};

function formatStatus(msg) {
  if (!msg) return "(pending — tx not yet indexed)";
  const label = STATUS_LABELS[msg.status] ?? msg.status;
  return label;
}

// ─── Core monitor function ────────────────────────────────────────────────────

/**
 * Poll LZ Scan until the message is delivered, failed, or timed out.
 *
 * @param {object}  opts
 * @param {string}  opts.txHash     Source chain transaction hash
 * @param {boolean} opts.testnet    true for testnet
 * @param {number}  [opts.pollMs]   Poll interval (default: 10 000 ms)
 * @param {number}  [opts.timeoutMs] Timeout (default: 300 000 ms)
 * @returns {Promise<{status: string, delivered: boolean, msg: object|null}>}
 */
async function monitorDelivery(opts) {
  const { txHash, testnet, pollMs = 10_000, timeoutMs = 300_000 } = opts;

  const deadline  = Date.now() + timeoutMs;
  let   lastStatus = "";

  while (Date.now() < deadline) {
    const msg    = await fetchLZStatus(txHash, testnet);
    const status = formatStatus(msg);

    if (status !== lastStatus) {
      console.log(`  [${new Date().toISOString()}] Status: ${status}`);
      lastStatus = status;
    }

    if (msg?.status === "DELIVERED") {
      return { status: "DELIVERED", delivered: true, msg };
    }
    if (msg?.status === "FAILED" || msg?.status === "BLOCKED") {
      return { status: msg.status, delivered: false, msg };
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  return { status: "TIMEOUT", delivered: false, msg: null };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const txHash    = process.env.TX_HASH;
  const pollMs    = Number(process.env.POLL_MS    ?? 10_000);
  const timeoutMs = Number(process.env.TIMEOUT_MS ?? 300_000);

  if (!txHash) {
    console.error("Set TX_HASH=<source-chain-tx-hash>");
    process.exit(1);
  }

  const network = (await ethers.provider.getNetwork()).name;
  const testnet = isTestnet(network);

  console.log();
  console.log("=".repeat(60));
  console.log("  LayerZero Delivery Monitor");
  console.log("=".repeat(60));
  console.log(`  Source network : ${network}`);
  console.log(`  TX hash        : ${txHash}`);
  console.log(`  Explorer       : ${explorerTxLink(network, txHash)}`);
  console.log(`  LZ Scan        : ${(testnet ? LZ_SCAN.testnet : LZ_SCAN.mainnet)}/tx/${txHash}`);
  console.log(`  Poll interval  : ${pollMs / 1000}s`);
  console.log(`  Timeout        : ${timeoutMs / 1000}s`);
  console.log("=".repeat(60));
  console.log();

  const result = await monitorDelivery({ txHash, testnet, pollMs, timeoutMs });

  console.log();
  console.log("=".repeat(60));
  if (result.delivered) {
    console.log("  DELIVERED successfully");
    if (result.msg?.dstTxHash) {
      console.log(`  Dst TX : ${result.msg.dstTxHash}`);
    }
  } else {
    console.log(`  Final status: ${result.status}`);
    if (result.msg?.error) console.log(`  Error  : ${result.msg.error}`);
  }
  console.log("=".repeat(60));
  console.log();

  if (!result.delivered) process.exit(1);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { monitorDelivery, fetchLZStatus };
