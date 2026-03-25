export default function handler(req, res) {
  const { scentType, purchaseDate, imageHash } = req.query;

  const metadata = {
    name: `香りの記憶 - ${scentType || 'お香'}`,
    description: "このNFTはお香の購入を証明するデジタル記録です。香りと共に過ごした豊かな時間をブロックチェーンに刻みます。",
    image: `ipfs://${imageHash || 'default_hash'}`,
    attributes: [
      {
        trait_type: "Scent Type",
        value: scentType || "Standard"
      },
      {
        trait_type: "Purchase Date",
        display_type: "date",
        value: purchaseDate || Math.floor(Date.now() / 1000)
      },
      {
        trait_type: "Experience",
        value: "AR Visualization"
      }
    ]
  };

  res.status(200).json(metadata);
}