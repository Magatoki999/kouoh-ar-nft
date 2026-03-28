// scripts/deploy.cjs
// Sepolia に KouohNFT をデプロイする
//
// 実行前に環境変数を設定:
//   PRIVATE_KEY   = デプロイ用ウォレットの秘密鍵（0x プレフィックス付き）
//   SEPOLIA_RPC_URL = Alchemy の Sepolia エンドポイント
//
// 実行コマンド:
//   npx hardhat run scripts/deploy.cjs --network sepolia

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("デプロイアドレス:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("残高:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("残高が0です。Sepoliaフォーセットでテスト用ETHを取得してください。");
  }

  console.log("\nKouohNFT をデプロイ中...");
  const KouohNFT = await hre.ethers.getContractFactory("KouohNFT");
  const contract = await KouohNFT.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ デプロイ完了!");
  console.log("CONTRACT_ADDRESS =", address);
  console.log("\nVercelの環境変数 CONTRACT_ADDRESS にこのアドレスを設定してください。");
  console.log(`\nEtherscan: https://sepolia.etherscan.io/address/${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
