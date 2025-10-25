const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * LayerZero V2 Endpoint Addresses
 * Source: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
 */
const LZ_ENDPOINTS = {
  // Mainnets
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
  polygon: "0x1a44076050125825900e736c501f859c50fE728c",
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  optimism: "0x1a44076050125825900e736c501f859c50fE728c",
  base: "0x1a44076050125825900e736c501f859c50fE728c",
  avalanche: "0x1a44076050125825900e736c501f859c50fE728c",
  bsc: "0x1a44076050125825900e736c501f859c50fE728c",

  // Testnets
  sepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  mumbai: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  arbitrumSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  optimismSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  baseSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║   CryptoPunks Market V2 Deployment Script         ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log();
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log();

  // Get LayerZero endpoint for this network
  let lzEndpoint = LZ_ENDPOINTS[network];

  // For local/hardhat network, deploy mock endpoint
  if (!lzEndpoint || network === "hardhat" || network === "localhost") {
    console.log("📡 Deploying Mock LayerZero Endpoint...");
    const MockLZEndpoint = await ethers.getContractFactory("MockLZEndpoint");
    const mockEndpoint = await MockLZEndpoint.deploy();
    await mockEndpoint.waitForDeployment();
    lzEndpoint = await mockEndpoint.getAddress();
    console.log("✅ Mock LZ Endpoint deployed to:", lzEndpoint);
    console.log();
  } else {
    console.log("📡 Using LayerZero Endpoint:", lzEndpoint);
    console.log();
  }

  // Deploy CryptoPunksMarketV2
  console.log("🚀 Deploying CryptoPunksMarketV2...");
  const CryptoPunksMarketV2 = await ethers.getContractFactory("CryptoPunksMarketV2");
  const cryptoPunks = await CryptoPunksMarketV2.deploy(lzEndpoint, deployer.address);

  await cryptoPunks.waitForDeployment();
  const contractAddress = await cryptoPunks.getAddress();

  console.log("✅ CryptoPunksMarketV2 deployed to:", contractAddress);
  console.log();

  // Display deployment summary
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║            Deployment Summary                      ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("Contract Address:", contractAddress);
  console.log("LayerZero Endpoint:", lzEndpoint);
  console.log("Total Punks:", await cryptoPunks.TOTAL_PUNKS());
  console.log("Image Hash:", await cryptoPunks.IMAGE_HASH());
  console.log("Owner:", await cryptoPunks.owner());
  console.log();

  // Save deployment info
  const deploymentInfo = {
    network: network,
    contractAddress: contractAddress,
    lzEndpoint: lzEndpoint,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  console.log("💾 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log();

  // Verification instructions
  if (network !== "hardhat" && network !== "localhost") {
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║            Verification Instructions               ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log("To verify the contract, run:");
    console.log();
    console.log(`npx hardhat verify --network ${network} ${contractAddress} "${lzEndpoint}" "${deployer.address}"`);
    console.log();
  }

  // Next steps
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║                 Next Steps                         ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("1. Verify contract on block explorer");
  console.log("2. Configure LayerZero peers for cross-chain transfers");
  console.log("3. Assign initial punk owners using setInitialOwner()");
  console.log("4. Call allInitialOwnersAssigned() when ready");
  console.log("5. Test marketplace functions");
  console.log();

  return {
    contractAddress,
    lzEndpoint,
    deployer: deployer.address,
  };
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
