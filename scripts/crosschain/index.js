/**
 * @file index.js
 * @description Cross-chain utilities entry point.
 *
 * Re-exports all helpers so consumers can do:
 *
 *   const cc = require("./scripts/crosschain");
 *   const fee = await cc.quoteSingleSend({ … });
 *   await cc.sendCrossChain({ … });
 *
 * Utility layout:
 *
 *   scripts/crosschain/
 *   ├── index.js      ← this file (re-exports everything)
 *   ├── constants.js  ← chain IDs, endpoints, explorers
 *   ├── quote.js      ← fee quoting (single + batch)
 *   ├── send.js       ← execute cross-chain send
 *   ├── verify.js     ← peer configuration verification
 *   └── monitor.js    ← delivery tracking via LZ Scan
 *
 * Solidity contracts:
 *
 *   contracts/utils/
 *   ├── CrossChainUtils.sol     ← Solady base: peer registry, fee helpers, Pausable
 *   ├── CrossChainSender.sol    ← Source-chain template (from-chain)
 *   └── CrossChainReceiver.sol  ← Destination-chain template (to-chain)
 */

"use strict";

const constants = require("./constants");
const quote     = require("./quote");
const send      = require("./send");
const verify    = require("./verify");
const monitor   = require("./monitor");

module.exports = {
  // ── Constants ──────────────────────────────────────────────────────────────
  ...constants,

  // ── Fee quoting ────────────────────────────────────────────────────────────
  quoteSingleSend:  quote.quoteSingleSend,
  quoteBatchSend:   quote.quoteBatchSend,

  // ── Sending ────────────────────────────────────────────────────────────────
  sendCrossChain:   send.sendCrossChain,

  // ── Peer verification ──────────────────────────────────────────────────────
  verifyPeer:       verify.verifyPeer,
  verifyAllPeers:   verify.verifyAllPeers,

  // ── Monitoring ─────────────────────────────────────────────────────────────
  monitorDelivery:  monitor.monitorDelivery,
  fetchLZStatus:    monitor.fetchLZStatus,
};
