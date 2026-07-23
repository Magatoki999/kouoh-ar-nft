const hre = require("hardhat");

async function main() {
  console.log("Deploying KouohNFT to Polygon PoS Mainnet...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "MATIC");

  if (balance === 0n) {
    throw new Error("MATICが不足しています。デプロイウォレットにMATICを送ってください。");
  }

  const KouohNFT = await hre.ethers.getContractFactory("KouohNFT");
  console.log("コンパイル済みコントラクトを取得しました");

  const nft = await KouohNFT.deploy();
  console.log("デプロイ中...");
  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log("✅ KouohNFT deployed to:", address);
  console.log("PolygonScan:", `https://polygonscan.com/address/${address}`);
  console.log("\n--- .env に追加してください ---");
  console.log(`POLYGON_CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });