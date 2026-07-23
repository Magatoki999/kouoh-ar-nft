// api/check-nft.js
// NFT所持確認 + ウォレット残高確認 統合API
//
// GET /api/check-nft?email=xxx@xxx.com  → メールからNFT所持確認
// GET /api/check-nft?wallet=true        → デプロイウォレットの残高確認（管理者用）

import { ethers } from 'ethers';

const NFT_ABI = [
  'function balanceOf(address owner) public view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256)',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── ウォレット残高確認モード（管理者用・旧check-wallet.js）────────
  if (req.query.wallet === 'true') {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      const signer   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      const address  = await signer.getAddress();
      const balance  = await provider.getBalance(address);
      return res.status(200).json({
        address,
        balance: ethers.formatEther(balance),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── NFT所持確認モード（旧check-nft.js）───────────────────────────
  const { email } = req.query;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'メールアドレスが不正です' });
  }

  const missing = ['PRIVY_APP_ID','PRIVY_SECRET_KEY','SEPOLIA_RPC_URL','CONTRACT_ADDRESS']
    .filter(k => !process.env[k]);
  if (missing.length) return res.status(500).json({ error: `環境変数未設定: ${missing.join(', ')}` });

  try {
    // ── Privyでウォレットアドレスを取得 ──────────────────────────
    const authHeader = `Basic ${Buffer.from(
      `${process.env.PRIVY_APP_ID}:${process.env.PRIVY_SECRET_KEY}`
    ).toString('base64')}`;
    const headers = {
      'Content-Type': 'application/json',
      'privy-app-id': process.env.PRIVY_APP_ID,
      'Authorization': authHeader,
    };

    const searchRes = await fetch(
      `https://auth.privy.io/api/v1/users?email=${encodeURIComponent(email)}`,
      { method: 'GET', headers }
    );

    if (!searchRes.ok) {
      return res.status(200).json({ hasNFT: false, walletAddress: null, tokenCount: 0 });
    }

    const searchData = await searchRes.json();
    const users = searchData.data || searchData;
    const user  = Array.isArray(users) ? users[0] : users;

    if (!user) {
      return res.status(200).json({ hasNFT: false, walletAddress: null, tokenCount: 0 });
    }

    const walletAccount = (user.linked_accounts || []).find(
      a => a.type === 'wallet' && a.chain_type === 'ethereum'
    );

    if (!walletAccount?.address) {
      return res.status(200).json({ hasNFT: false, walletAddress: null, tokenCount: 0 });
    }

    const walletAddress = walletAccount.address;

    // ── NFT残高を確認 ────────────────────────────────────────────
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, NFT_ABI, provider);

    const balance    = await contract.balanceOf(walletAddress);
    const tokenCount = Number(balance);

    if (tokenCount === 0) {
      return res.status(200).json({ hasNFT: false, walletAddress, tokenCount: 0 });
    }

    const tokens = [];
    try {
      for (let i = 0; i < Math.min(tokenCount, 3); i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
        tokens.push(tokenId.toString());
      }
    } catch {
      // tokenOfOwnerByIndex未実装の場合はスキップ
    }

    console.log(`[check-nft] ${email} → wallet:${walletAddress} tokens:${tokenCount}`);
    return res.status(200).json({ hasNFT: true, walletAddress, tokenCount, tokens });

  } catch (err) {
    console.error('[check-nft]', err);
    return res.status(500).json({ error: err.message });
  }
}
