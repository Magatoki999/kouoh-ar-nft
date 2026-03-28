// api/nft-info.js
// TXハッシュから NFT 情報（メタデータ）を取得して返す
// GET /api/nft-info?txHash=0x...
// nft.html がこのエンドポイントを呼んで購入記録を表示する

import { ethers } from 'ethers';

const NFT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function tokenURI(uint256 tokenId) public view returns (string memory)',
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { txHash } = req.query;
  if (!txHash || !txHash.startsWith('0x')) {
    return res.status(400).json({ error: 'txHash が指定されていません' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

    // ── TX レシートから tokenId を取得 ───────────────────────────
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return res.status(404).json({ error: 'トランザクションが見つかりません' });
    }

    // Transfer イベントから tokenId をデコード
    const iface = new ethers.Interface(NFT_ABI);
    let tokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'Transfer') {
          tokenId = parsed.args.tokenId;
          break;
        }
      } catch (_) { /* 別コントラクトのログはスキップ */ }
    }

    if (tokenId === null) {
      return res.status(404).json({ error: 'Transfer イベントが見つかりません' });
    }

    // ── tokenURI からメタデータを取得 ────────────────────────────
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      NFT_ABI,
      provider
    );
    const tokenURI = await contract.tokenURI(tokenId);

    // IPFS URI の場合は HTTP ゲートウェイ経由で取得
    const metadataUrl = tokenURI.startsWith('ipfs://')
      ? tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/')
      : tokenURI;

    const metaRes  = await fetch(metadataUrl);
    const metadata = await metaRes.json();

    // ── attributes を key→value のフラットオブジェクトに変換 ─────
    const attrs = {};
    if (Array.isArray(metadata.attributes)) {
      for (const a of metadata.attributes) {
        const key = (a.trait_type || '').toLowerCase().replace(/\s+/g, '_');
        attrs[key] = a.value;
      }
    }

    return res.status(200).json({
      name:          metadata.name,
      description:   metadata.description,
      image:         metadata.image,
      // nft.html で使うフィールド（kouoh 購入記録）
      product:       attrs.product       || metadata.name,
      series:        attrs.series        || '古都の香り',
      scent:         attrs.scent         || 'うつせみ',
      storeName:     attrs.store         || '香老舗 ○○堂',
      date:          attrs.purchase_date || '',
      quantity:      attrs.quantity      || 1,
      amount:        attrs['amount_(jpy)'] || 0,
      certId:        attrs.certificate_id || '',
      tokenId:       tokenId.toString(),
    });

  } catch (err) {
    console.error('[nft-info] エラー:', err);
    return res.status(500).json({ error: err.message });
  }
}
