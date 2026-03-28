// api/mint-nft.js
// 1. Privy でメールアドレスからウォレットを自動生成
// 2. ERC-721 NFT を Sepolia にミント
// 3. Resend でメール通知
// POST /api/mint-nft
// body: { email, product, scentType, storeName, date, amount, quantity, paymentIntentId }

import { ethers } from 'ethers';
import { Resend } from 'resend';

// ★ トップレベルで new Resend() しない（環境変数未設定時にクラッシュするため）
// sendEmail() 内で遅延初期化する

// ── ERC-721 最小 ABI（mint 関数のみ） ──────────────────────────────
const NFT_ABI = [
  'function mintNFT(address recipient, string memory tokenURI) public returns (uint256)',
  'function tokenURI(uint256 tokenId) public view returns (string memory)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

// ── Privy: メールアドレス → ウォレットアドレス取得 or 新規生成 ──────
// Privy API は新規・既存ともに 200 or 201 でユーザーオブジェクトを返す
// 409 の場合は既存ユーザーをメール検索して取得する
async function getOrCreateWallet(email) {
  const authHeader = `Basic ${Buffer.from(
    `${process.env.PRIVY_APP_ID}:${process.env.PRIVY_SECRET_KEY}`
  ).toString('base64')}`;
  const baseHeaders = {
    'Content-Type': 'application/json',
    'privy-app-id': process.env.PRIVY_APP_ID,
    'Authorization': authHeader,
  };

  // ユーザー作成（200/201 = 成功、409 = 既存）
  const createRes = await fetch('https://auth.privy.io/api/v1/users', {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({
      linked_accounts: [{ type: 'email', address: email }],
      create_ethereum_wallet: true,
    }),
  });

  let userData;

  if (createRes.status === 200 || createRes.status === 201) {
    // 新規作成成功（200 と 201 どちらも受け入れる）
    userData = await createRes.json();

  } else if (createRes.status === 409) {
    // 既存ユーザー → メールで検索
    console.log('[mint-nft] Privy: 既存ユーザー検索中...');
    const searchRes = await fetch(
      `https://auth.privy.io/api/v1/users?email=${encodeURIComponent(email)}`,
      { method: 'GET', headers: baseHeaders }
    );
    if (!searchRes.ok) {
      const t = await searchRes.text();
      throw new Error(`Privy 既存ユーザー取得失敗: ${searchRes.status} ${t}`);
    }
    const searchData = await searchRes.json();
    const users = searchData.data || searchData;
    userData = Array.isArray(users) ? users[0] : users;

    // ウォレットがなければ追加
    const hasWallet = userData?.linked_accounts?.some(
      a => a.type === 'wallet' && a.chain_type === 'ethereum'
    );
    if (!hasWallet && userData?.id) {
      const walletRes = await fetch(
        `https://auth.privy.io/api/v1/users/${userData.id}/wallets`,
        {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ chain_type: 'ethereum' }),
        }
      );
      if (walletRes.ok) userData = await walletRes.json();
    }

  } else {
    const errText = await createRes.text();
    throw new Error(`Privy API エラー: ${createRes.status} ${errText}`);
  }

  // linked_accounts からウォレットアドレスを取り出す
  const accounts = userData?.linked_accounts || [];
  const wallet = accounts.find(
    a => a.type === 'wallet' && a.chain_type === 'ethereum'
  );
  if (!wallet?.address) {
    throw new Error('ウォレットアドレスが見つかりません');
  }
  console.log('[mint-nft] wallet address:', wallet.address);
  return wallet.address;
}

// ── NFT メタデータ URI を生成（/api/metadata 経由） ────────────────
function buildMetadataUrl(baseUrl, params) {
  const q = new URLSearchParams({
    product:   params.product,
    scentType: params.scentType,
    storeName: params.storeName,
    series:    params.series,
    date:      params.date,
    quantity:  String(params.quantity),
    amount:    String(params.amount),
    certId:    params.certId,
    season:    params.season,   // ← 季節を追加
  });
  return `${baseUrl}/api/metadata?${q.toString()}`;
}

// ── Sepolia に NFT ミント ───────────────────────────────────────────
async function mintNFT(recipientAddress, tokenURI) {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const signer   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    NFT_ABI,
    signer
  );

  const tx = await contract.mintNFT(recipientAddress, tokenURI);
  const receipt = await tx.wait();
  return receipt.hash;
}

// ── Resend でメール通知 ─────────────────────────────────────────────
async function sendEmail({ email, product, quantity, amount, certId, txHash, nftPageUrl, season }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const SEASON_JP = { spring:'春', summer:'夏', autumn:'秋', winter:'冬' };
  const seasonJp = SEASON_JP[season] || '春';

  // from: 環境変数 RESEND_FROM があればそちらを使用
  // 未設定時は Resend 認証不要の onboarding@resend.dev（Freeプラン動作確認用）
  // 本番運用時は magatokilab.com を Resend で DNS 認証してから変更する
  const fromAddress = process.env.RESEND_FROM || 'onboarding@resend.dev';

  const { data, error } = await resend.emails.send({
    from:    fromAddress,
    to:      email,
    subject: `【香訪AR】空蝉（${seasonJp}）購入証明NFTが届きました`,
    html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="background:#0d0a04; color:#e8e0d0; font-family:'Yu Mincho','Hiragino Mincho ProN',serif; padding:32px 16px; margin:0;">
  <div style="max-width:480px; margin:0 auto;">

    <p style="font-size:22px; color:#D4AF37; letter-spacing:4px; margin-bottom:4px;">香訪 (Kouoh) AR</p>
    <p style="font-size:12px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-bottom:32px;">Purchase Certificate NFT — ${seasonJp}の香り</p>

    <p style="font-size:14px; line-height:2; color:rgba(255,255,255,0.75);">
      このたびはお香をご購入いただき、誠にありがとうございます。<br>
      ${seasonJp}限定デザインの購入証明NFTを発行いたしました。
    </p>

    <div style="margin:24px 0; background:rgba(255,255,255,0.04); border:1px solid rgba(212,175,55,0.3); border-radius:12px; padding:20px;">
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr><td style="color:rgba(255,255,255,0.4); padding:6px 0; width:40%;">商品名</td><td style="color:#fff;">${product}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4); padding:6px 0;">シリーズ</td><td style="color:#fff;">古都の香り</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4); padding:6px 0;">NFTデザイン</td><td style="color:#D4AF37;">${seasonJp}限定</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4); padding:6px 0;">数量</td><td style="color:#fff;">${quantity} 個</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4); padding:6px 0;">お支払い金額</td><td style="color:#fff;">¥${Number(amount).toLocaleString()}（税込）</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4); padding:6px 0;">証明 ID</td><td style="color:#D4AF37; font-family:monospace; font-size:11px;">${certId}</td></tr>
      </table>
    </div>

    <a href="${nftPageUrl}" style="
      display:block; text-align:center; padding:16px;
      background:linear-gradient(135deg,#b8962e,#D4AF37);
      color:#1a1208; font-weight:bold; font-size:15px; letter-spacing:2px;
      border-radius:10px; text-decoration:none; margin-bottom:24px;
    ">NFT確認ページで見る →</a>

    <p style="font-size:11px; color:rgba(255,255,255,0.3); line-height:2;">
      ブロックチェーン上の記録はいつでもご確認いただけます。<br>
      このメールはシステムより自動送信されています。
    </p>

    <p style="font-size:11px; color:rgba(255,255,255,0.2); margin-top:24px;">
      MAGATOKI Laboratory<br>
      <a href="https://kouoh-ar-nft.vercel.app" style="color:rgba(212,175,55,0.4);">kouoh-ar-nft.vercel.app</a>
    </p>
  </div>
</body>
</html>
    `.trim(),
  });

  if (error) {
    console.error('[mint-nft] Resend エラー:', JSON.stringify(error));
    throw new Error(`メール送信失敗: ${error.message || JSON.stringify(error)}`);
  }
  console.log('[mint-nft] Resend 送信成功 id:', data?.id, '→', email, 'from:', fromAddress);
}

// ── メインハンドラ ───────────────────────────────────────────────────
export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
  },
  maxDuration: 60, // Vercel Pro: 最大60秒（NFTミントに時間がかかるため）
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 環境変数チェック
  const missing = ['PRIVY_APP_ID','PRIVY_SECRET_KEY','SEPOLIA_RPC_URL','PRIVATE_KEY','CONTRACT_ADDRESS','RESEND_API_KEY']
    .filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('[mint-nft] 環境変数が未設定:', missing);
    return res.status(500).json({ error: `環境変数が未設定: ${missing.join(', ')}` });
  }

  const {
    email,
    product         = '空蝉',
    scentType       = 'utsusemi',
    storeName       = '薫香堂',
    series          = '古都の香り',
    date            = new Date().toLocaleDateString('ja-JP'),
    amount          = 440,
    quantity        = 1,
    season          = 'spring',   // ← フロントの getSeason() から渡る
    paymentIntentId = '',
  } = req.body;

  // バリデーション
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'メールアドレスが不正です' });
  }

  // 証明 ID 生成（PURCHASE-XXXXXX）
  const certId = `PURCHASE-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  try {
    // ── Step 1: Privy でウォレット取得 or 生成 ─────────────────────
    console.log('[mint-nft] Privy wallet 取得中:', email);
    const walletAddress = await getOrCreateWallet(email);
    console.log('[mint-nft] wallet:', walletAddress);

    // ── Step 2: メタデータ URI 構築 ────────────────────────────────
    const proto   = req.headers['x-forwarded-proto'] || 'https';
    const host    = req.headers['x-forwarded-host']  || req.headers.host;
    const baseUrl = `${proto}://${host}`;

    const tokenURI = buildMetadataUrl(baseUrl, {
      product, scentType, storeName, series, date, quantity, amount, certId, season,
    });

    // ── Step 3: NFT ミント ─────────────────────────────────────────
    console.log('[mint-nft] ミント開始 → recipient:', walletAddress);
    const txHash = await mintNFT(walletAddress, tokenURI);
    console.log('[mint-nft] ミント完了 txHash:', txHash);

    // ── Step 4: メール通知 ─────────────────────────────────────────
    const nftPageUrl = `${baseUrl}/nft.html?tx=${txHash}`;
    await sendEmail({ email, product, quantity, amount, certId, txHash, nftPageUrl, season });
    console.log('[mint-nft] メール送信完了:', email);

    return res.status(200).json({
      success: true,
      txHash,
      certId,
      walletAddress,
      nftPageUrl,
    });

  } catch (err) {
    console.error('[mint-nft] エラー:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
