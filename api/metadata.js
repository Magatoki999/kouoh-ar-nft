// api/metadata.js
// NFT メタデータを動的生成して返す（ERC-721 tokenURI 用）
// GET /api/metadata?product=...&season=spring|summer|autumn|winter&...

// ── 季節別 IPFS CID（Pinata アップロード済み） ─────────────────────
// 空蝉用のCID
const SEASON_CID_UTSUSEMI = {
  spring: 'bafybeiealihgm5fyqad3l773b6s57jsjdlzys6uyyqgisyj5oiikojfhkm',
  summer: 'bafybeiffouvigrmi4xdkt4pmnso665x4ftle5drnzjz7aa3pj6oum3tqfu',
  autumn: 'bafybeie3ij7htgefofdl4j467on6qbjwjmfvpm5llwavieaxljhm2h5mta',
  winter: 'bafybeic3k7q5674x36w6wk6wcrfc77ihvzpwdlq2qwjoc7ehtqlczxshkm',
};

// 夕顔用のCID
const SEASON_CID_YUGAO = {
  spring: 'bafybeiauki2m4e4ugzld6dvima4uvaw4pobvbeegsqugadbmsrbjwcu6cu',
  summer: 'bafybeieofabmhangje7odeikauixusd2t5k3juwvzxsrqzzbwfsmqmbtsy',
  autumn: 'bafybeiglovec34a3atgswfdkkosybr7wphafqe3pinkg5hzmitnqffr4t4',
  winter: 'bafybeihqpc73fzregp76cgnv4lhsxod5ikelaxvfvoutk3g4koaj4bxusa',
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
    scentType = 'utsusemi',
    product   = scentType === 'yugao' ? '夕顔' : '空蝉',
    storeName = '薫香堂',
    series    = '古都の香り',
    date      = new Date().toLocaleDateString('ja-JP'),
    quantity  = '1',
    amount    = '440',
    certId    = 'PURCHASE-000000',
    season    = 'spring',
  } = req.query;

  // scentType に応じて参照するCIDリストを切り替え
  const cidMap   = scentType === 'yugao' ? SEASON_CID_YUGAO : SEASON_CID_UTSUSEMI;
  const cid      = cidMap[season] || cidMap.spring;
  const imageUrl = `${IPFS_GATEWAY}${cid}`;
  const seasonJp = SEASON_JP[season] || '春';

  const metadata = {
    name:         `${product} — ${seasonJp}の香り / 購入証明NFT`,
    description:  `古都の香り「${product}」購入証明NFT\n${seasonJp}限定デザイン\n\n商品：${product}\n数量：${quantity}個\nシリーズ：${series}\n\nお香の購入をブロックチェーンに永久記録しました。`,
    image:        imageUrl,
    external_url: 'https://kouoh-ar-nft.vercel.app',
    attributes: [
      { trait_type: 'Product',        value: product },
      { trait_type: 'Series',         value: series },
      { trait_type: 'Scent',          value: `${product}香` },
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