/**
 * api/metadata.js
 * NFTメタデータ動的生成 — 購入記録版
 *
 * 流用元: goshuin-ar-hounou/api/metadata.js
 * 変更点: 参拝記録 → 購入記録 / attributes再設計
 *
 * GET /api/metadata?tokenId=1
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId } = req.query;
  if (!tokenId) {
    return res.status(400).json({ error: 'tokenId is required' });
  }

  try {
    // 本番ではDBからtokenId紐付けデータを取得する
    // Phase1はStripe payment_intentのmetadataから生成
    const metadata = buildMetadata({
      tokenId: Number(tokenId),
      productName: req.query.product || '和のお香',
      brandName:   req.query.brand   || 'KOUOH',
      storeName:   req.query.store   || 'MAGATOKI Laboratory',
      purchaseDate: req.query.date   || new Date().toISOString().split('T')[0],
      certificateId: req.query.cert  || `PURCHASE-${tokenId.padStart(6, '0')}`,
      // NFT画像はIPFS固定 or 動的生成（Phase2で対応）
      imageURI: process.env.NFT_IMAGE_BASE_URI
        ? `${process.env.NFT_IMAGE_BASE_URI}/${tokenId}.png`
        : `https://kouoh-ar-nft.vercel.app/nft-image-placeholder.png`,
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(metadata);

  } catch (err) {
    console.error('[metadata] Error:', err);
    return res.status(500).json({ error: 'Failed to generate metadata' });
  }
}

/**
 * ERC-721メタデータを生成
 * OpenSea互換 + 購入記録属性
 */
function buildMetadata({ tokenId, productName, brandName, storeName, purchaseDate, certificateId, imageURI }) {
  return {
    name: `${brandName} Purchase Certificate #${String(tokenId).padStart(3, '0')}`,
    description: `${productName}の購入証明NFTです。このトークンはブロックチェーン上に永久に記録されます。\n\nIssued by ${storeName}`,
    image: imageURI,
    external_url: `https://kouoh-ar-nft.vercel.app/nft.html?tokenId=${tokenId}`,
    attributes: [
      {
        trait_type: 'Product',
        value: productName,
      },
      {
        trait_type: 'Brand',
        value: brandName,
      },
      {
        trait_type: 'Store',
        value: storeName,
      },
      {
        trait_type: 'Purchase Date',
        value: purchaseDate,
      },
      {
        trait_type: 'Certificate ID',
        value: certificateId,
      },
      {
        trait_type: 'Token ID',
        value: String(tokenId),
        display_type: 'number',
      },
    ],
  };
}
