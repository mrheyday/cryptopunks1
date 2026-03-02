/**
 * @file constants.js
 * @description LayerZero V2 cross-chain constants: endpoint addresses,
 *              chain endpoint IDs (eID), and block explorer URLs.
 *
 * Source: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
 */

// ─── LayerZero V2 Endpoint Addresses ────────────────────────────────────────
// Same address on every EVM chain (immutable proxy)
const LZ_ENDPOINT_MAINNET = "0x1a44076050125825900e736c501f859c50fE728c";
const LZ_ENDPOINT_TESTNET = "0x6EDCE65403992e310A62460808c4b910D972f10f";

const LZ_ENDPOINTS = {
  // ── Mainnets ──────────────────────────────────────────────────────────────
  ethereum:  LZ_ENDPOINT_MAINNET,
  polygon:   LZ_ENDPOINT_MAINNET,
  arbitrum:  LZ_ENDPOINT_MAINNET,
  optimism:  LZ_ENDPOINT_MAINNET,
  base:      LZ_ENDPOINT_MAINNET,
  avalanche: LZ_ENDPOINT_MAINNET,
  bsc:       LZ_ENDPOINT_MAINNET,
  zksync:    LZ_ENDPOINT_MAINNET,
  linea:     LZ_ENDPOINT_MAINNET,
  scroll:    LZ_ENDPOINT_MAINNET,

  // ── Testnets ─────────────────────────────────────────────────────────────
  sepolia:          LZ_ENDPOINT_TESTNET,
  mumbai:           LZ_ENDPOINT_TESTNET,
  arbitrumSepolia:  LZ_ENDPOINT_TESTNET,
  optimismSepolia:  LZ_ENDPOINT_TESTNET,
  baseSepolia:      LZ_ENDPOINT_TESTNET,
  avalancheFuji:    LZ_ENDPOINT_TESTNET,
  bscTestnet:       LZ_ENDPOINT_TESTNET,
  lineaSepolia:     LZ_ENDPOINT_TESTNET,
};

// ─── LayerZero V2 Chain Endpoint IDs (eID) ──────────────────────────────────
const CHAIN_EIDS = {
  // ── Mainnets ──────────────────────────────────────────────────────────────
  ethereum:  30101,
  bsc:       30102,
  avalanche: 30106,
  polygon:   30109,
  arbitrum:  30110,
  optimism:  30111,
  base:      30184,
  zksync:    30165,
  linea:     30183,
  scroll:    30214,
  mantle:    30181,
  mode:      30260,

  // ── Testnets ─────────────────────────────────────────────────────────────
  sepolia:         40161,
  mumbai:          40109,
  arbitrumSepolia: 40231,
  optimismSepolia: 40232,
  baseSepolia:     40245,
  avalancheFuji:   40106,
  bscTestnet:      40102,
  lineaSepolia:    40287,
};

// ─── Block Explorer URLs ─────────────────────────────────────────────────────
const EXPLORERS = {
  // ── Mainnets ──────────────────────────────────────────────────────────────
  ethereum:  "https://etherscan.io",
  polygon:   "https://polygonscan.com",
  arbitrum:  "https://arbiscan.io",
  optimism:  "https://optimistic.etherscan.io",
  base:      "https://basescan.org",
  avalanche: "https://snowtrace.io",
  bsc:       "https://bscscan.com",
  zksync:    "https://explorer.zksync.io",
  linea:     "https://lineascan.build",
  scroll:    "https://scrollscan.com",

  // ── Testnets ─────────────────────────────────────────────────────────────
  sepolia:         "https://sepolia.etherscan.io",
  mumbai:          "https://mumbai.polygonscan.com",
  arbitrumSepolia: "https://sepolia.arbiscan.io",
  optimismSepolia: "https://sepolia-optimism.etherscan.io",
  baseSepolia:     "https://sepolia.basescan.org",
  avalancheFuji:   "https://testnet.snowtrace.io",
  bscTestnet:      "https://testnet.bscscan.com",
};

// ─── LayerZero Scan ──────────────────────────────────────────────────────────
const LZ_SCAN = {
  mainnet: "https://layerzeroscan.com",
  testnet: "https://testnet.layerzeroscan.com",
};

// ─── Native Gas Token Symbols ─────────────────────────────────────────────────
const NATIVE_TOKEN = {
  ethereum:        "ETH",
  polygon:         "MATIC",
  arbitrum:        "ETH",
  optimism:        "ETH",
  base:            "ETH",
  avalanche:       "AVAX",
  bsc:             "BNB",
  zksync:          "ETH",
  linea:           "ETH",
  scroll:          "ETH",
  sepolia:         "ETH",
  mumbai:          "MATIC",
  arbitrumSepolia: "ETH",
  optimismSepolia: "ETH",
  baseSepolia:     "ETH",
  avalancheFuji:   "AVAX",
  bscTestnet:      "BNB",
};

// ─── Chain Groups ────────────────────────────────────────────────────────────
const MAINNET_CHAINS  = ["ethereum", "polygon", "arbitrum", "optimism", "base", "avalanche", "bsc", "zksync", "linea", "scroll"];
const TESTNET_CHAINS  = ["sepolia", "mumbai", "arbitrumSepolia", "optimismSepolia", "baseSepolia", "avalancheFuji", "bscTestnet", "lineaSepolia"];
const L2_CHAINS       = ["arbitrum", "optimism", "base", "zksync", "linea", "scroll"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if the network is a testnet */
function isTestnet(network) {
  return TESTNET_CHAINS.includes(network);
}

/** Returns the LayerZero endpoint address for a network */
function getEndpoint(network) {
  const ep = LZ_ENDPOINTS[network];
  if (!ep) throw new Error(`No LayerZero endpoint for network: ${network}`);
  return ep;
}

/** Returns the LayerZero eID for a network */
function getEid(network) {
  const eid = CHAIN_EIDS[network];
  if (!eid) throw new Error(`No chain eID for network: ${network}`);
  return eid;
}

/** Returns a human-readable tx link for a block explorer */
function explorerTxLink(network, txHash) {
  const base = EXPLORERS[network];
  if (!base) return txHash;
  return `${base}/tx/${txHash}`;
}

/** Returns the LayerZero scan link for a cross-chain message */
function lzScanLink(txHash, testnet = false) {
  const base = testnet ? LZ_SCAN.testnet : LZ_SCAN.mainnet;
  return `${base}/tx/${txHash}`;
}

module.exports = {
  LZ_ENDPOINTS,
  CHAIN_EIDS,
  EXPLORERS,
  LZ_SCAN,
  NATIVE_TOKEN,
  MAINNET_CHAINS,
  TESTNET_CHAINS,
  L2_CHAINS,
  isTestnet,
  getEndpoint,
  getEid,
  explorerTxLink,
  lzScanLink,
};
