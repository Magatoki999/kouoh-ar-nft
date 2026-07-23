// api/check-jpyc.js
// GET /api/check-jpyc?address=0x...
// Polygon PoS上のJPYC残高を確認して2000JPYC以上かチェック

import { ethers } from 'ethers';

// Polygon PoS上の全JPYCコントラクト（新旧対応）
const JPYC_ADDRESSES = [
  '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB', // JPYC Prepaid（新）
  '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29', // JPYC v2（2025年〜）
  '0x6ae7dfc73e0dde2aa99ac063dcf7e8a63265108c', // JPY Coin PoS（旧）
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const MINIMUM_JPYC = 2000; // 2000 JPYC以上で特典解放

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return res.status(400).json({ error: 'ウォレットアドレスが不正です' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    let totalJpyc = 0;
    const balances = {};

    for (const contractAddress of JPYC_ADDRESSES) {
      try {
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
        const [balance, decimals] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals(),
        ]);
        const amount = parseFloat(ethers.formatUnits(balance, decimals));
        balances[contractAddress] = amount;
        totalJpyc += amount;
      } catch (_) {
        balances[contractAddress] = 0;
      }
    }

    const isHolder = totalJpyc >= MINIMUM_JPYC;

    return res.status(200).json({
      address,
      totalJpyc: Math.floor(totalJpyc),
      isHolder,
      minimum: MINIMUM_JPYC,
    });

  } catch (err) {
    console.error('[check-jpyc] エラー:', err);
    return res.status(500).json({ error: err.message });
  }
}
