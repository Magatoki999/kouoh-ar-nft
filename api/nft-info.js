import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x3A637bD5a5Ff49667Ff279BDa263c9118e7b2a03';

const ABI = [
  'function getRecord(uint256 tokenId) public view returns (tuple(string shrine, string date, string weather, string timeOfDay, string blessing, string lang, uint256 amount, uint256 timestamp))',
  'function tokenURI(uint256 tokenId) public view returns (string)'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { txHash } = req.query;
  if (!txHash) return res.status(400).json({ error: 'txHashが必要です' });

  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    
    // TXからtokenIdを取得
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(404).json({ error: 'トランザクションが見つかりません' });

    // Transfer eventのtokenIdを取得
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const log = receipt.logs.find(l => l.topics[0] === transferTopic);
    if (!log) return res.status(404).json({ error: 'NFTが見つかりません' });
    
    const tokenId = BigInt(log.topics[3]).toString();
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    const record = await contract.getRecord(tokenId);
    const uri = await contract.tokenURI(tokenId);

    // IPFSメタデータを取得
    const ipfsUrl = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    const metaRes = await fetch(ipfsUrl);
    const metadata = await metaRes.json();

    const imageUrl = metadata.image?.replace('ipfs://', 'https://ipfs.io/ipfs/');

    return res.status(200).json({
      tokenId,
      txHash,
      image: imageUrl,
      name: metadata.name,
      shrine: record[0],
      date: record[1],
      weather: record[2],
      timeOfDay: record[3],
      blessing: record[4],
      lang: record[5],
      amount: record[6].toString(),
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}