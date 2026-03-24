# kouoh-ar-nft セットアップ手順

## 1. リポジトリ作成

```bash
# GitHubでリポジトリを作成後:
git clone https://github.com/Magatoki999/kouoh-ar-nft.git
cd kouoh-ar-nft
npm install
```

## 2. goshuin-ar-hounou から移植するファイル

以下のファイルをそのままコピーし、差分のみ修正する。

### そのままコピー（変更不要）
- `api/nft-info.js`
- `api/check-wallet.js`
- `sw.js`

### コピー後に軽微な文言変更
- `api/create-payment.js` → productName / description の文言を購入向けに
- `api/webhook.js` → metadata のkeyは変えずに文言だけ調整

### 参照して index.html に移植
- goshuin-ar-hounou の `index.html` から以下を抜き出す:
  - Stripe Payment Intentフロー（openResultModal / createPaymentIntent）
  - Privy メールアドレス入力 → mint-nft.js 呼び出し
  - 決済成功画面・エラーハンドリング
  - `initStripe()` の実装（インスタンス1つルール）

## 3. 変更が必要なファイル（本リポジトリに含む）

- `api/metadata.js` ✅ 作成済み（購入記録版）
- `api/mint-nft.js` ✅ 作成済み（KouohNFT対応）
- `contracts/KouohNFT.sol` ✅ 作成済み
- `index.html` ✅ スケルトン作成済み（UI実装が必要）
- `vercel.json` ✅ 作成済み
- `package.json` ✅ 作成済み

## 4. 新規で用意が必要なアセット

### 最優先
- [ ] `targets.mind` — 商品パッケージor専用カードのMindARターゲット
  - MindAR Image Target Compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile
  - 推奨: 特徴点が多い画像（グラデーション・ベタ塗りはNG）

### 次のステップ
- [ ] `avatar.glb` — イメージキャラクターの3Dモデル
  - 代替案: 2D画像をA-Frame Planeに貼る（`a-plane`）
  - 既存: goshuin-ar-hounou の oritsuru_merrygoround.glb を仮置きとして使用可
- [ ] アンビエントサウンド（任意）
- [ ] NFT画像（IPFSアップロード用）

## 5. コントラクトデプロイ

```bash
# Hardhatを使う場合
npm install --save-dev hardhat @openzeppelin/contracts

# Sepoliaにデプロイ
npx hardhat run scripts/deploy.js --network sepolia

# デプロイ後、Vercelの環境変数に CONTRACT_ADDRESS を設定
```

## 6. Vercel 環境変数設定

Vercel ダッシュボード → Settings → Environment Variables に以下を追加:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PRIVY_APP_ID=...
PRIVY_SECRET_KEY=...
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
PRIVATE_KEY=0x...（デプロイ専用ウォレット）
RESEND_API_KEY=re_...
CONTRACT_ADDRESS=0x...（KouohNFT デプロイアドレス）
```

## 7. goshuin-ar-hounou との対応表

| goshuin-ar-hounou | kouoh-ar-nft | 備考 |
|---|---|---|
| 参拝証明 | 購入証明 | — |
| 奉納金額 | 購入金額 | — |
| 御朱印AR | お香AR | — |
| 飛梅・鶴 | アバター（要作成） | — |
| GoshuinNFT | KouohNFT | コントラクト名変更 |
| 参拝記録 attribute | Purchase Date / Product | メタデータ再設計済み |
| 朱色UI (#722F37) | 金茶UI (#D4955A) | index.htmlで変数化 |

## 8. 開発ローカル確認

```bash
# Vercel CLIで開発サーバー起動
npx vercel dev

# Stripe Webhook転送（別ターミナル）
stripe listen --forward-to localhost:3000/api/webhook
```
