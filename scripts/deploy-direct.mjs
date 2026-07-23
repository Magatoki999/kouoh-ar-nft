import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

// コンパイル済みABIとバイトコードを読み込む
const artifact = JSON.parse(readFileSync('./artifacts/contracts/KouohNFT.sol/KouohNFT.json', 'utf8'));

async function main() {
  const rpcUrl = 'https://polygon-mainnet.g.alchemy.com/v2/s999E8Q6r3W5-FcHR52XS';
  console.log('RPC URL:', rpcUrl);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log('Deployer:', signer.address);

  const balance = await provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'MATIC');

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  console.log('デプロイ中...');

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('✅ KouohNFT deployed to:', address);
  console.log('PolygonScan:', `https://polygonscan.com/address/${address}`);
  console.log('\n--- .env に追加 ---');
  console.log(`POLYGON_CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });