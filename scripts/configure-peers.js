const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * LayerZero V2 Chain Endpoint IDs (eID)
 * Source: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
 */
const CHAIN_EIDS = {
  // Mainnets
  ethereum: 30101,
  polygon: 30109,
  arbitrum: 30110,
  optimism: 30111,
  base: 30184,
  avalanche: 30106,
  bsc: 30102,

  // Testnets
  sepolia: 40161,
  mumbai: 40109,
  arbitrumSepolia: 40231,
  optimismSepolia: 40232,
  baseSepolia: 40245,
};

/**
 * Configure LayerZero peers for cross-chain transfers
 *
 * This script sets up trusted remote addresses on different chains
 * so that the contract can send/receive NFTs across chains
 *
 * Usage:
 * 1. Deploy contract on Chain A and Chain B
 * 2. Run this script on Chain A with Chain B's contract address
 * 3. Run this script on Chain B with Chain A's contract address
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║      LayerZero Peer Configuration Script          ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log();
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log();

  // Get contract address (you should update this with your deployed address)
  const LOCAL_CONTRACT = process.env.LOCAL_CONTRACT_ADDRESS;
  if (!LOCAL_CONTRACT) {
    throw new Error("Please set LOCAL_CONTRACT_ADDRESS in .env file");
  }

  // Get the contract instance
  const CryptoPunksMarketV2 = await ethers.getContractFactory("CryptoPunksMarketV2");
  const contract = CryptoPunksMarketV2.attach(LOCAL_CONTRACT);

  console.log("Local Contract:", LOCAL_CONTRACT);
  console.log();

  // Example: Configure peers for cross-chain communication
  // You need to provide the remote contract addresses
  const peersToAdd = [
    // Example configuration - update with actual deployed addresses
    // {
    //   chain: "polygon",
    //   eid: CHAIN_EIDS.polygon,
    //   address: "0x..." // Your deployed contract address on Polygon
    // },
    // {
    //   chain: "arbitrum",
    //   eid: CHAIN_EIDS.arbitrum,
    //   address: "0x..." // Your deployed contract address on Arbitrum
    // },
  ];

  if (peersToAdd.length === 0) {
    console.log("⚠️  No peers configured. Update the script with remote contract addresses.");
    console.log();
    console.log("Example configuration:");
    console.log(`{
  chain: "polygon",
  eid: ${CHAIN_EIDS.polygon},
  address: "0x1234...5678"
}`);
    console.log();
    return;
  }

  // Set peers
  for (const peer of peersToAdd) {
    console.log(`🔗 Setting peer for ${peer.chain} (eID: ${peer.eid})`);
    console.log(`   Remote address: ${peer.address}`);

    // Convert address to bytes32
    const peerBytes32 = ethers.zeroPadValue(peer.address, 32);

    try {
      const tx = await contract.setPeer(peer.eid, peerBytes32);
      console.log(`   Transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Peer configured successfully`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log();
  }

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║              Configuration Complete                ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log();
  console.log("✅ Peer configuration completed");
  console.log();
  console.log("Next steps:");
  console.log("1. Repeat this process on all chains where you deployed");
  console.log("2. Test cross-chain transfers with sendPunkCrossChain()");
  console.log("3. Quote fees with quoteSendPunk() before transferring");
  console.log();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main, CHAIN_EIDS };
