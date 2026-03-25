const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log("--- Network Check ---");
  console.log("Network Name: ", hre.network.name);
  console.log("Deployer Address: ", deployer.address);
  console.log("Balance (Wei): ", balance.toString());
  console.log("Balance (ETH): ", hre.ethers.formatEther(balance));
  
  if (balance === 0n) {
    console.log("⚠️ エラー: このアドレスにはETHが入っていません。");
  } else {
    console.log("✅ 準備完了: デプロイ可能です。");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});