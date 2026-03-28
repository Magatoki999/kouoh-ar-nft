// api/metadata.js
// NFT メタデータを動的生成して返す（ERC-721 tokenURI 用）
// GET /api/metadata?product=...&season=spring|summer|autumn|winter&...

// ── 季節別 IPFS CID（Pinata アップロード済み） ─────────────────────
// 春: UtsusemiNFT001.png
// 夏: UtsusemiNFT002.png
// 秋: UtsusemiNFT003.png
// 冬: UtsusemiNFT004.png
const SEASON_CID = {
  spring: 'bafybeiclxevpoz24ejqz5a77xc5i5eckuzlxib4drn73mdigxghcwhhvg4',
  summer: 'bafybeic3nfo3zs4au2nupemjkxojeyb4wrrdbsc6lgoqjp3yekzauilivu',
  autumn: 'bafybeid7qqfmb4b335jre7qjornd64piihjou6upuniyzlstyzogfbd6ky',
  winter: 'bafybeicrqdchqicaa37chuihiuncyfecthpg6zwknbffqp25bwtpsoywym',
};

const SEASON_JP = {
  spring: '春', summer: '夏', autumn: '秋', winter: '冬',
};

// Pinata 公開ゲートウェイ
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    product   = '空蝉',
    scentType = 'utsusemi',
    storeName = '薫香堂',
    series    = '古都の香り',
    date      = new Date().toLocaleDateString('ja-JP'),
    quantity  = '1',
    amount    = '440',
    certId    = 'PURCHASE-000000',
    season    = 'spring',
  } = req.query;

  const cid      = SEASON_CID[season] || SEASON_CID.spring;
  const imageUrl = `${IPFS_GATEWAY}${cid}`;
  const seasonJp = SEASON_JP[season] || '春';

  const metadata = {
    name:         `空蝉 — ${seasonJp}の香り / 購入証明NFT`,
    description:  `古都の香り「空蝉」購入証明NFT\n${seasonJp}限定デザイン\n\n商品：${product}\n数量：${quantity}個\nシリーズ：${series}\n\nお香の購入をブロックチェーンに永久記録しました。`,
    image:        imageUrl,
    external_url: 'https://kouoh-ar-nft.vercel.app',
    attributes: [
      { trait_type: 'Product',        value: product },
      { trait_type: 'Series',         value: series },
      { trait_type: 'Scent',          value: '空蝉香' },
      { trait_type: 'Store',          value: storeName },
      { trait_type: 'Season',         value: seasonJp },
      { trait_type: 'Purchase Date',  value: date },
      { display_type: 'number', trait_type: 'Quantity',    value: Number(quantity) },
      { display_type: 'number', trait_type: 'Amount (JPY)', value: Number(amount) },
      { trait_type: 'Certificate ID', value: certId },
      { trait_type: 'Blockchain',     value: 'Sepolia Testnet' },
    ],
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).json(metadata);
}
