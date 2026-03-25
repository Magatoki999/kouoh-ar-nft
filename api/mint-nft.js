import { ethers } from 'ethers';
import KouohNFTABI from '../contracts/KouohNFT.json'; // コンパイル後のABI

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { address, scentType, metadataURI } = req.body;

  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, KouohNFTABI.abi, wallet);

    // KouohNFT.sol の safeMint(to, uri, brandName, scentType)
    const tx = await contract.safeMint(
      address,
      metadataURI,
      "香訪 (Kouoh)", // ブランド名固定
      scentType || "白檀"
    );

    const receipt = await tx.wait();
    res.status(200).json({ success: true, txHash: receipt.hash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}