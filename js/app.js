// --- 設定 ---
const STRIPE_PUBLISHABLE_KEY = "pk_test_...あなたの公開鍵...";
const PRIVY_APP_ID = "...あなたのPrivy App ID...";

let stripe;
let elements;
let card;
let clientSecret = null;

// --- 1. 初期化 ---
document.addEventListener('DOMContentLoaded', async () => {
    // Stripeの初期化
    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    
    // UI要素の取得
    const mintBtn = document.getElementById('mint-start-btn');
    const paymentModal = document.getElementById('payment-modal');
    const submitBtn = document.getElementById('submit-payment-btn');

    // NFT発行開始ボタンのクリック
    mintBtn.addEventListener('click', () => {
        openPaymentModal();
    });

    // 決済実行ボタンのクリック
    submitBtn.addEventListener('click', async () => {
        await handlePaymentSubmit();
    });
});

// --- 2. 決済モーダルの表示とStripeの準備 ---
async function openPaymentModal() {
    const modal = document.getElementById('payment-modal');
    const statusMsg = document.getElementById('payment-error');
    modal.style.display = 'flex';
    statusMsg.innerText = "準備中...";

    try {
        // バックエンドから PaymentIntent を作成
        const response = await fetch('/api/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scentType: 'utsusemi' }) // お香の種類を指定
        });
        const data = await response.json();
        clientSecret = data.clientSecret;

        // Stripe Elements のマウント
        elements = stripe.elements();
        card = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#3d342d',
                    fontFamily: 'Sawarabi Mincho, serif',
                }
            }
        });
        card.mount('#stripe-card-element');
        statusMsg.innerText = "";
    } catch (err) {
        statusMsg.innerText = "決済の準備に失敗しました。";
        console.error(err);
    }
}

// --- 3. 決済の実行 ---
async function handlePaymentSubmit() {
    const submitBtn = document.getElementById('submit-payment-btn');
    const statusMsg = document.getElementById('payment-error');
    
    submitBtn.disabled = true;
    statusMsg.innerText = "決済処理中...";

    const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: card }
    });

    if (error) {
        statusMsg.innerText = "エラー: " + error.message;
        submitBtn.disabled = false;
    } else if (paymentIntent.status === 'succeeded') {
        statusMsg.innerText = "決済成功！NFTを発行します...";
        // 決済成功後、Privyでログインさせてミントを実行
        await handlePrivyAndMint();
    }
}

// --- 4. PrivyログインとNFTミント（発行） ---
async function handlePrivyAndMint() {
    try {
        // Privyの初期化（インライン読み込みが想定される場合）
        const privy = new PrivyClient({
            appId: PRIVY_APP_ID,
            config: { loginMethods: ['email', 'google'] }
        });

        // ログイン（未ログインの場合のみ）
        let user = await privy.getUser();
        if (!user) {
            user = await privy.login();
        }

        // ユーザーのウォレットアドレスを取得
        const address = user.wallet.address;
        console.log("Minting to:", address);

        // バックエンドのミントAPIを叩く
        const response = await fetch('/api/mint-nft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address,
                scentType: 'utsusemi',
                metadataURI: `https://${window.location.hostname}/api/metadata?scentType=utsusemi`
            })
        });

        const result = await response.json();

        if (result.success) {
            showResult(result.txHash);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        alert("NFTの発行に失敗しました: " + err.message);
        console.error(err);
    }
}

// --- 5. 結果の表示 ---
function showResult(txHash) {
    document.getElementById('payment-modal').style.display = 'none';
    const resultModal = document.getElementById('result-modal');
    resultModal.style.display = 'flex';
    
    const link = document.getElementById('tx-link');
    link.innerHTML = `<a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank">Etherscanで確認する</a>`;
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}