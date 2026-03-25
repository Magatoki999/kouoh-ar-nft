const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const KouohNFT = await hre.ethers.getContractFactory("KouohNFT");
  const nft = await KouohNFT.deploy();

  await nft.waitForDeployment();

  console.log("KouohNFT deployed to:", await nft.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});