# kouoh-ar-nft

**お香 AR × 購入証明NFT システム**

> お香商品を購入した瞬間、ARでイメージキャラクターが出現し、購入証明NFTが自動発行されるシステム。
> お客さまはブロックチェーンを一切意識せず、メールアドレスを入力するだけ。
> 現在はキャラクターとの会話（AI + 音声合成）や、フリマ出展者向けのAR名刺機能なども統合された、
> 単なる購入証明NFTシステムを超えた複合プロジェクトになっている。

---

## 体験フロー（実装済み）

```
お客さまが商品パッケージ（またはカード）にスマホをかざす
    ↓
ARでキャラクター（空蝉 / 夕顔）が出現、テキストチャットで会話できる（Claude API + Gemini TTS）
    ↓
季節・天気（Open-Meteo）・時間帯に応じて演出や語り口が変化
    ↓
数量を選んで「購入する」— Stripeで決済（カード / Apple Pay / Google Pay）
    ↓
購入完了（この時点ではまだNFTは発行されない）
    ↓
メールアドレスを入力（ウォレット不要）
    ↓
Privyが自動でウォレットを生成 → Polygon上にNFTをミント
    ↓
Resendでメール通知 → nft.htmlでNFT画像・購入記録を確認
```

> JPYC（日本円ステーブルコイン）をPolygon上に2,000枚以上保有しているウォレットは、
> 追加の特典演出（光の輪エフェクト）が解放される。

---

## ベースプロジェクト

[goshuin-ar-hounou](https://github.com/Magatoki999/goshuin-ar-hounou)（御朱印AR × 奉納決済）の「参拝証明」を「購入証明」に置き換えたバージョン。

決済〜Webhook〜ミントの骨格部分は流用元のロジックをほぼそのまま踏襲しているが、
その後の開発でキャラクター会話・フリマ出展者機能・管理ダッシュボードなど、
ベースプロジェクトには無かった機能が大きく追加されている。

---

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| AR | MindAR 1.2.2 + A-Frame 1.4.2（`viewer.html` / `viewer_both.html`）、Three.js r128 直書き（`viewer_plane.html` / `artist/index.html`） |
| ホスティング | Vercel（静的ファイル + Serverless Functions） |
| 決済 | Stripe（カード / Apple Pay / Google Pay） |
| ウォレット生成 | Privy（Embedded Wallet、メールアドレスのみでEOA生成） |
| NFT | ERC-721（`KouohNFT`、OpenZeppelin `ERC721URIStorage` + `Ownable`） |
| ブロックチェーン | **Polygon PoS Mainnet**（Sepolia Testnetからは移行済み） |
| メタデータ | IPFS（Pinata）に季節×商品ごとの画像を事前ピン留め + `/api/metadata`で動的JSON生成 |
| 会話AI | Claude API（`claude-sonnet-4-6`） |
| 音声合成 | Gemini TTS（`gemini-2.5-flash-preview-tts`） |
| KVストア | Upstash Redis（いいねカウンタ・フリマ出展者データ） |
| メール通知 | Resend |
| 送信元ドメイン | magatokilab.com |

> ⚠️ **Sepolia表記が一部残存**：`check-nft.js`（NFT所持確認モード）と`admin.html`のトランザクションリンクは
> まだSepolia Testnetを参照している。Polygon移行時の更新漏れなので、触る際は要確認。

---

## ファイル構成（実装済みベース）

```
kouoh-ar-nft/
├── index.html               # 入口ゲート（viewer / viewer_plane / storeへの導線）
├── store.html                # 本体アプリ：AR + チャット + 決済 + ミント（メイン導線）
├── viewer.html                # AR体験（MindAR、空蝉・夕顔 同時認識対応）
├── viewer_both.html           # AR体験（MindAR、同時認識版の派生）
├── viewer_plane.html          # AR体験（Three.js直書き、マーカーレス／端末の傾きで配置）
├── nft.html                  # NFT確認ページ（多言語対応）
├── register.html              # フリマ出展者（アーティスト）登録フォーム
├── artist/
│   └── index.html             # 出展者ごとの個別AR会話ページ
├── admin.html                 # 売上・NFT発行ダッシュボード（パスワード認証）
├── legal.html                 # 特定商取引法に基づく表記
├── debug.html / debug2.html   # 実機診断用の簡易ログビューア
├── sw.js                      # Service Worker
├── vercel.json                # Vercel設定（outputDirectory必須・静的アセットのルーティング）
├── package.json
├── contracts/
│   ├── KouohNFT.sol           # ERC-721コントラクト
│   └── KouohNFT.json          # コンパイル済みABI/バイトコード
├── scripts/
│   ├── deploy-polygon.cjs     # Polygon PoSへのデプロイ（現行）
│   ├── deploy.cjs / deploy-direct.mjs  # Sepolia向け旧デプロイスクリプト
│   └── check-balance.cjs      # デプロイウォレットの残高確認
├── js/
│   └── app.js                 # 初期プロトタイプ（未使用と思われる。store.htmlのインラインJSに置き換え済み）
├── *.glb                      # utsusemi / yugao / dr_ohma / aciel の3Dキャラクターモデル
├── *.mind                     # targets / targetNFT / yugao / both のMindARターゲット
├── *.mp3 / *.png              # ボイス・環境音・シーン参照画像
└── api/
    ├── create-payment.js      # Stripe PaymentIntent生成
    ├── webhook.js             # Stripe Webhook受信（決済確認の記録のみ。自動ミントはしない）
    ├── mint-nft.js            # Privyウォレット生成 + Polygonミント + Resendメール送信
    ├── nft-info.js            # TXハッシュ → NFT情報取得
    ├── metadata.js            # NFTメタデータ動的生成（季節×商品で画像を出し分け）
    ├── check-nft.js           # NFT所持確認 + デプロイウォレット残高確認（旧check-wallet.js統合）
    ├── check-jpyc.js          # JPYC残高チェック（特典解放判定）
    ├── chat.js                # キャラクターAI会話（出展者ペルソナ・多言語対応含む）
    ├── tts.js                 # 音声合成（Gemini TTS）
    ├── like.js                # キャラクター別いいねカウンタ
    ├── artist.js               # フリマ出展者の登録・取得
    └── admin.js                # 管理ダッシュボード向け集計API
```

---

## 決済〜ミントの実際の流れ（重要）

Webhook（`api/webhook.js`）は `payment_intent.succeeded` を受け取っても、PaymentIntentの
`metadata` に `payment_confirmed: 'true'` を書き足すだけで、**ミントは実行しない**。

ミントを実行するのはフロントエンド（`store.html`の`doMintNFT()`）で、購入完了後にお客さまが
メールアドレスを入力したタイミングで `/api/mint-nft` を直接呼び出す。この時 Stripeの決済ID
（`paymentIntent.id`）は `txid` というキー名で送られ、`mint-nft.js`側で
`txid || paymentIntentId` として後方互換的に受け取っている。

専用のDBは持たず、Stripeの `PaymentIntent.metadata` を簡易的な購入記録台帳として使っている
（`admin.js`の売上集計もここから直接読んでいる）。

---

## 環境変数（Vercel）

| KEY | 用途 |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Webhook署名検証 |
| `PRIVY_APP_ID` | Privy アプリID |
| `PRIVY_SECRET_KEY` | Privy シークレットキー |
| `POLYGON_RPC_URL` | Polygon PoS RPCエンドポイント（ミント・照会に使用） |
| `POLYGON_CONTRACT_ADDRESS` | Polygon上のKouohNFTコントラクトアドレス |
| `SEPOLIA_RPC_URL` | Sepolia RPCエンドポイント（`check-nft.js`のみ使用・要見直し） |
| `CONTRACT_ADDRESS` | Sepolia上のKouohNFTコントラクトアドレス（`check-nft.js`のみ使用・要見直し） |
| `PRIVATE_KEY` | ミント実行ウォレットの秘密鍵 |
| `RESEND_API_KEY` | Resend APIキー |
| `RESEND_FROM` | メール送信元アドレス（未設定時 `onboarding@resend.dev`） |
| `ANTHROPIC_API_KEY` | Claude API キー（`chat.js`） |
| `GEMINI_API_KEY` | Gemini TTS APIキー（`tts.js`） |
| `KV_REST_API_URL` | Upstash Redis REST URL（`like.js`・`artist.js`） |
| `KV_REST_API_TOKEN` | Upstash Redis REST トークン |
| `ADMIN_PASSWORD` | 管理ダッシュボードのパスワード（単純文字列比較） |

> `POLYGON_*` と `SEPOLIA_*` / `CONTRACT_ADDRESS` の2系統が併存している。
> `check-nft.js` だけPolygon移行に追従できていないため、実運用前に統一を検討すること。

---

## NFTメタデータ設計（`api/metadata.js`が動的生成）

画像は季節（春夏秋冬）×商品（空蝉／夕顔）の組み合わせで、Pinataに事前アップロード済みの
固定IPFS CIDから出し分けている。JSON自体はオンチェーンに保存せず、`tokenURI`が
`/api/metadata?...` を指すことでリクエストの都度生成される。

```json
{
  "name": "空蝉 — 春の香り / 購入証明NFT",
  "description": "古都の香り「空蝉」購入証明NFT\n春限定デザイン\n...",
  "image": "https://gateway.pinata.cloud/ipfs/...",
  "external_url": "https://kouoh-ar-nft.vercel.app",
  "attributes": [
    { "trait_type": "Product", "value": "空蝉" },
    { "trait_type": "Series", "value": "古都の香り" },
    { "trait_type": "Scent", "value": "空蝉香" },
    { "trait_type": "Store", "value": "薫香堂" },
    { "trait_type": "Season", "value": "春" },
    { "trait_type": "Purchase Date", "value": "2026-XX-XX" },
    { "display_type": "number", "trait_type": "Quantity", "value": 1 },
    { "display_type": "number", "trait_type": "Amount (JPY)", "value": 440 },
    { "trait_type": "Certificate ID", "value": "PURCHASE-XXXXXX" },
    { "trait_type": "Blockchain", "value": "Sepolia Testnet" }
  ]
}
```

> ⚠️ `attributes` 内の `Blockchain` はコード上まだ `"Sepolia Testnet"` 固定。
> 実際のミント先はPolygonのため、表記の更新が必要。

---

## 重要な実装メモ（goshuin-ar-hounou から引き継ぎ・今も有効）

### vercel.jsonにoutputDirectoryが必須

```json
{
  "outputDirectory": ".",
  "routes": [...]
}
```

新しいアセット（3Dモデル・音声・マーカー画像など）を追加する際は、`vercel.json`の`routes`に
個別ルートを追加しないと配信されない（publicフォルダの自動配信のような仕組みは無い）。

### Privy API（`create_ethereum_wallet: true`が正解）

```js
body: JSON.stringify({
  linked_accounts: [{ type: 'email', address: email }],
  create_ethereum_wallet: true,  // ← これが正解
  // create_embedded_wallet: true  ← 旧仕様（エラー）
})
```

### Stripeインスタンスはトップレベルで生成しない

環境変数未設定時に関数全体がクラッシュしてデプロイが壊れるのを避けるため、
`create-payment.js` / `webhook.js` / `admin.js` はいずれも `new Stripe()` を
ハンドラ内・環境変数チェックの後に呼び出している。

---

## 現状メモ・要検討事項

- **Sepolia/Polygonの表記統一**：`check-nft.js`・`admin.html`のEtherscanリンク・`metadata.js`のattributesがPolygon移行に未追従
- **`js/app.js`は使われていない可能性が高い**：`store.html`のインラインJSに機能が移っており、他ページから読み込まれている形跡が見当たらない
- **Webhookからの自動ミントは未実装**：`webhook.js`内にコメントアウトされた`triggerMintNFT()`が残っている。決済前にメールアドレスをPaymentIntentに紐付けるフローに変更すれば有効化できる設計
- **`viewer.html`と`viewer_both.html`の役割整理**：両方とも同時認識AR体験だが、`index.html`からリンクされているのは`viewer.html`のみ

## 開発フェーズ

### Phase 1（実施済み）— 実証実験
- Polygon PoSでのミント運用に移行済み
- 空蝉・夕顔の2商品 + Dr. Ohma・Acielを含む4キャラクター体制
- キャラクター会話・音声合成・JPYC特典・フリマ出展者機能を追加実装

### Phase 2 — 整理・本番化
- Sepolia参照の残存箇所（`check-nft.js`・`admin.html`・`metadata.js`）をPolygonに統一
- Stripe本番審査
- `viewer.html` / `viewer_both.html`の統合整理

### Phase 3 — 拡張
- 商品ラインナップ別アバターの追加
- シリアルナンバー付き限定NFT
- 購入回数に応じたレアリティ変化

---

*MAGATOKI Laboratory*
