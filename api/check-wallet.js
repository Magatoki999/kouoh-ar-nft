import { ethers } from 'ethers';

export default async function handler(req, res) {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);
  
  return res.status(200).json({
    address: address,
    balance: ethers.formatEther(balance)
  });
}