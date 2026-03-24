# kouoh-ar-nft

**お香 AR × 購入証明NFT システム**

> お香商品を購入した瞬間、ARでイメージキャラクター（アバター）が出現し、購入証明NFTが自動発行されるシステム。  
> お客さまはブロックチェーンを一切意識せず、メールアドレスを入力するだけ。

---

## 体験フロー

```
お客さまが商品パッケージ（またはカード）にスマホをかざす
    ↓
ARでアバター＋煙エフェクトが出現
    ↓
「このお香を購入する」— 金額を選んで決済
    ↓
カード / Apple Pay / Google Pay で支払い
    ↓
購入完了 + 証明ID発行
    ↓
メールアドレスを入力するだけ（ウォレット不要）
    ↓
Privyが自動でウォレットを生成
    ↓
購入証明NFTが発行される
    ↓
メール通知 → 専用ページでNFT画像・購入記録を確認
```

---

## ベースプロジェクト

[goshuin-ar-hounou](https://github.com/Magatoki999/goshuin-ar-hounou)（御朱印AR × 奉納決済）の「参拝証明」を「購入証明」に置き換えたバージョン。

### 流用部分（変更最小）

| ファイル | 流用元 | 変更内容 |
| --- | --- | --- |
| `api/create-payment.js` | ほぼそのまま | 商品名・金額の表現変更 |
| `api/webhook.js` | ほぼそのまま | metadata種別変更 |
| `api/mint-nft.js` | ほぼそのまま | メール文言変更 |
| `api/nft-info.js` | 変更なし | — |
| `api/metadata.js` | 変更あり | 参拝記録→購入記録 |
| `nft.html` | UIリデザイン | お香ブランドカラー |
| `legal.html` | 文言変更 | 特定商取引法表記更新 |
| `vercel.json` | 変更なし | — |

### 新規作成部分

| ファイル | 内容 |
| --- | --- |
| `index.html` | AR画面全体リデザイン（お香ブランドUI） |
| `targets.mind` | 商品パッケージ or 専用カードのMindARターゲット |
| `avatar.glb` | イメージキャラクター3Dモデル（または2Dアニメ） |
| `contracts/KouohNFT.sol` | ERC-721コントラクト（GoshuinNFT.solベース改変） |
| `incense-smoke.js` | 煙エフェクトコンポーネント（既存流用 or 新規） |

---

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| AR | MindAR 1.2.2 + A-Frame 1.4.2 |
| ホスティング | Vercel |
| 決済 | Stripe（カード / Apple Pay / Google Pay） |
| ウォレット生成 | Privy（Embedded Wallet） |
| NFT | ERC-721（KouohNFT） |
| ブロックチェーン | Sepolia Testnet → Polygon zkEVM（予定） |
| メタデータ | IPFS（Pinata） + 動的生成API |
| メール通知 | Resend |
| 送信元ドメイン | noreply@magatokilab.com |

---

## ファイル構成

```
kouoh-ar-nft/
├── index.html              # メインARアプリ（購入UI・NFT受取UI）
├── nft.html                # NFT確認ページ
├── legal.html              # 特定商取引法に基づく表記
├── sw.js                   # Service Worker
├── vercel.json             # Vercel設定
├── targets.mind            # MindAR 画像認識ターゲット
├── avatar.glb              # イメージキャラクター（要作成）
├── incense-smoke.js        # 煙エフェクトA-Frameコンポーネント
├── package.json
├── contracts/
│   └── KouohNFT.sol        # ERC-721コントラクト
└── api/
    ├── create-payment.js   # Stripe Payment Intent生成
    ├── webhook.js          # Stripe Webhook受信 → NFTミントトリガー
    ├── mint-nft.js         # Privy + NFTミント + Resendメール送信
    ├── nft-info.js         # TXハッシュ → NFT情報取得
    ├── metadata.js         # NFTメタデータ動的生成（購入記録）
    └── check-wallet.js     # ウォレット残高確認（開発用）
```

---

## 環境変数（Vercel）

| KEY | 説明 |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開可能キー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名シークレット |
| `PRIVY_APP_ID` | Privy アプリID |
| `PRIVY_SECRET_KEY` | Privy シークレットキー |
| `SEPOLIA_RPC_URL` | Alchemy Sepolia RPC URL |
| `PRIVATE_KEY` | デプロイ専用ウォレット秘密鍵 |
| `RESEND_API_KEY` | Resend APIキー |
| `CONTRACT_ADDRESS` | KouohNFT コントラクトアドレス（Sepolia） |

---

## NFTメタデータ設計（購入記録）

```json
{
  "name": "KOUOH Purchase Certificate #001",
  "description": "お香購入証明NFT — [商品名]",
  "image": "ipfs://...",
  "attributes": [
    { "trait_type": "Product",      "value": "商品名" },
    { "trait_type": "Brand",        "value": "お香ブランド名" },
    { "trait_type": "Purchase Date","value": "2026-XX-XX" },
    { "trait_type": "Store",        "value": "店舗名" },
    { "trait_type": "Certificate",  "value": "PURCHASE-XXXXXX" }
  ]
}
```

---

## 重要な実装メモ（goshuin-ar-hounou から引き継ぎ）

### vercel.jsonにoutputDirectoryが必須

```json
{
  "outputDirectory": ".",
  "routes": [...]
}
```

### Privy API（2026年3月時点の正しい仕様）

```js
body: JSON.stringify({
  linked_accounts: [{ type: 'email', address: email }],
  create_ethereum_wallet: true,  // ← これが正解
  // create_embedded_wallet: true  ← 旧仕様（エラー）
})
```

### Stripeのインスタンスは1つだけ

```js
var stripeInstance;
function initStripe() {
  stripeInstance = Stripe('pk_...');
}
if (!cardElement) initStripe();
```

---

## 開発フェーズ

### Phase 1（現在）— 実証実験
- Sepolia Testnetでのミント
- 1商品のみ対応
- 固定ARターゲット（専用カード）

### Phase 2 — 本番化
- Stripe本番審査
- Polygon zkEVM移行
- 複数商品・複数ARターゲット対応

### Phase 3 — 拡張
- 商品ラインナップ別アバター
- シリアルナンバー付き限定NFT
- 購入回数に応じたレアリティ変化

---

*MAGATOKI Laboratory*
