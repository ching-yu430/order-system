// 榮 鹽水雞點餐系統 - 系統設定檔
// 榮 鹽水雞點餐系統 - 系統設定檔
const SYSTEM_CONFIG = {
    // 1. Firebase Firestore 設定
    firebaseConfig: {
        apiKey: "AIzaSyAb2UyKW-75CFySTht4eaHPiVPXTMDUVNU",
        authDomain: "order-system2026.firebaseapp.com",
        projectId: "order-system2026",
        storageBucket: "order-system2026.firebasestorage.app",
        messagingSenderId: "700941758492",
        appId: "1:700941758492:web:5b968cdeb45e4b37376fd9"
    },


    // 2. Discord Webhook 設定
    // 顧客下單後，訂單通知會即時傳送到此 Webhook URL 的 Discord 頻道中
    discordWebhookUrl: "https://script.google.com/macros/s/AKfycbyUmYxwNqU06dLApezfhlnC489gNO6Xow_UhwwM4tXFSQFaTlafB7iJXRSgbsCF63c/exec",

    // 3. 店家後台管理密碼


    // 4. 配菜預設價格 (單價，單位：元)
    defaultSideDishPrice: 20,

    // 5. 預設每日去骨雞腿上限
    defaultDrumstickQuota: 5
};

// 如果在 Node 環境下（例如 GitHub Actions 執行重置腳本時），導出設定
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SYSTEM_CONFIG;
}
