/**
 * api/mint-nft.js
 * Privy ウォレット生成 → KouohNFT ミント → Resend メール送信
 *
 * 流用元: goshuin-ar-hounou/api/mint-nft.js
 * 変更点:
 *   - ミント対象コントラクト → KouohNFT
 *   - メール文言 → 購入証明
 *   - NFT名・説明文
 */

import { ethers } from 'ethers';
import { Resend } from 'resend';

// KouohNFT ABI（mintPurchaseCertificate のみ）
const KOUOH_NFT_ABI = [
  'function mintPurchaseCertificate(address to, string tokenURI_, string certificateId, string productName) public returns (uint256)',
  'event PurchaseCertified(address indexed to, uint256 indexed tokenId, string certificateId, string productName)',
];

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, certificateId, productName, brandName, storeName, purchaseDate } = req.body;

  if (!email || !certificateId) {
    return res.status(400).json({ error: 'email and certificateId are required' });
  }

  try {
    // 1. Privy でウォレット生成（メールアドレスに紐付け）
    const walletAddress = await createPrivyWallet(email);
    console.log('[mint-nft] Wallet created:', walletAddress);

    // 2. NFTメタデータURIを構築
    //    本番ではPinataにアップロードしたIPFS URIを使う
    //    Phase1は動的APIで代用
    const tokenURIBase = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://kouoh-ar-nft.vercel.app';

    // 3. NFTミント
    const { tokenId, txHash } = await mintNFT({
      to: walletAddress,
      certificateId,
      productName: productName || 'お香',
      tokenURIBase,
    });
    console.log('[mint-nft] Minted tokenId:', tokenId, 'txHash:', txHash);

    // 4. メール通知
    await sendEmail({
      to: email,
      tokenId,
      txHash,
      certificateId,
      productName: productName || 'お香',
      brandName: brandName || 'KOUOH',
      storeName: storeName || 'MAGATOKI Laboratory',
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
      tokenURIBase,
    });
    console.log('[mint-nft] Email sent to:', email);

    return res.status(200).json({
      success: true,
      walletAddress,
      tokenId,
      txHash,
      certificateId,
    });

  } catch (err) {
    console.error('[mint-nft] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to mint NFT' });
  }
}

// ---------------------------------------------------------------------------
// Privy ウォレット生成
// ---------------------------------------------------------------------------
async function createPrivyWallet(email) {
  const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
  const PRIVY_SECRET_KEY = process.env.PRIVY_SECRET_KEY;

  const credentials = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_SECRET_KEY}`).toString('base64');

  // ユーザー作成（既存なら409）
  const createRes = await fetch('https://auth.privy.io/api/v1/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'privy-app-id': PRIVY_APP_ID,
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify({
      linked_accounts: [{ type: 'email', address: email }],
      create_ethereum_wallet: true, // 2026年3月時点の正しい仕様
    }),
  });

  if (createRes.ok) {
    const user = await createRes.json();
    const wallet = user.linked_accounts?.find(a => a.type === 'wallet');
    if (wallet?.address) return wallet.address;
  }

  // 既存ユーザーの場合はメールで検索
  const searchRes = await fetch(
    `https://auth.privy.io/api/v1/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        'privy-app-id': PRIVY_APP_ID,
        'Authorization': `Basic ${credentials}`,
      },
    }
  );
  const searchData = await searchRes.json();
  const user = searchData.data?.[0];
  const wallet = user?.linked_accounts?.find(a => a.type === 'wallet');
  if (!wallet?.address) throw new Error('Failed to get wallet address from Privy');

  return wallet.address;
}

// ---------------------------------------------------------------------------
// NFTミント
// ---------------------------------------------------------------------------
async function mintNFT({ to, certificateId, productName, tokenURIBase }) {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    KOUOH_NFT_ABI,
    signer
  );

  // tokenURIはmint後にIDが確定するため、動的APIに向ける
  // 実IDはeventから取得するので仮値でも可
  const tempTokenURI = `${tokenURIBase}/api/metadata?cert=${certificateId}`;

  const tx = await contract.mintPurchaseCertificate(
    to,
    tempTokenURI,
    certificateId,
    productName
  );
  const receipt = await tx.wait();

  // PurchaseCertified イベントからtokenIdを取得
  const iface = new ethers.Interface(KOUOH_NFT_ABI);
  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === 'PurchaseCertified') {
        tokenId = parsed.args.tokenId.toString();
        break;
      }
    } catch (_) {}
  }

  return { tokenId, txHash: receipt.hash };
}

// ---------------------------------------------------------------------------
// メール送信
// ---------------------------------------------------------------------------
async function sendEmail({ to, tokenId, txHash, certificateId, productName, brandName, storeName, purchaseDate, tokenURIBase }) {
  const nftPageUrl = `${tokenURIBase}/nft.html?tx=${txHash}`;
  const sepoliaUrl = `https://sepolia.etherscan.io/tx/${txHash}`;

  await resend.emails.send({
    from: 'noreply@magatokilab.com',
    to,
    subject: `【${brandName}】購入証明NFTが届きました`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #8B5E3C;">✉️ ${brandName} 購入証明NFT</h2>
        <p>このたびは <strong>${productName}</strong> をお買い上げいただき、誠にありがとうございます。</p>
        <p>ご購入の証明NFTが発行されました。以下のページでご確認いただけます。</p>

        <div style="background: #FFF8F0; border-left: 4px solid #D4955A; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px;"><strong>商品名</strong>：${productName}</p>
          <p style="margin: 0 0 8px;"><strong>購入日</strong>：${purchaseDate}</p>
          <p style="margin: 0 0 8px;"><strong>証明書ID</strong>：${certificateId}</p>
          <p style="margin: 0;"><strong>NFT Token ID</strong>：#${tokenId}</p>
        </div>

        <a href="${nftPageUrl}"
           style="display: inline-block; background: #8B5E3C; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          購入証明NFTを確認する
        </a>

        <p style="margin-top: 32px; font-size: 12px; color: #999;">
          ブロックチェーン上の記録：<a href="${sepoliaUrl}" style="color: #999;">${txHash.slice(0, 20)}...</a>
        </p>

        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;">
        <p style="font-size: 11px; color: #BBB;">
          ${storeName} — Powered by MAGATOKI Laboratory<br>
          このメールにお心当たりのない場合は、無視していただいて構いません。
        </p>
      </div>
    `,
  });
}
