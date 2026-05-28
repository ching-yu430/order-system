// 榮 鹽水雞點餐系統 - 資料庫與 LocalStorage 適配器
// 支援 Firebase Firestore 與本地 LocalStorage 降級模擬

const DEFAULT_MENU = [
    // 1. 招牌飽足：主食雞肉 (main)
    { id: "half_chicken", name: "半隻 (僅雞腿去骨，附脆筍)", price: 120, type: "main", status: true },
    { id: "chicken_drumstick", name: "去骨雞腿", price: 60, type: "main", status: true },
    { id: "chicken_breast", name: "雞胸", price: 60, type: "main", status: true },
    { id: "chicken_wing", name: "雞翅", price: 15, type: "main", status: true },
    
    // 2. 越嚼越香：啃骨與內臟 (bone)
    { id: "chicken_neck", name: "脖子", price: 5, type: "bone", status: true },
    { id: "chicken_feet", name: "雞腳 (4隻)", price: 10, type: "bone", status: true },
    { id: "chicken_heart", name: "雞心", price: 20, type: "bone", status: true },
    { id: "cockscomb", name: "雞冠", price: 20, type: "bone", status: true },
    { id: "chicken_gizzard", name: "雞胗", price: 20, type: "bone", status: true },
    { id: "pig_intestine", name: "生腸", price: 20, type: "bone", status: true },
    { id: "egg_yolk", name: "蛋卵", price: 20, type: "bone", status: true },
    { id: "chicken_skin", name: "雞皮", price: 20, type: "bone", status: true },
    
    // 3. 經典必點：人氣配料 (addon)
    { id: "tempura", name: "甜不辣", price: 20, type: "addon", status: true },
    { id: "baiye_tofu", name: "百葉豆腐", price: 20, type: "addon", status: true },
    { id: "tofu_skin", name: "豆包 (豆皮)", price: 20, type: "addon", status: true },
    { id: "dried_tofu", name: "滷豆干/盒", price: 40, type: "addon", status: true },
    { id: "pig_ears", name: "豬耳朵/盒", price: 40, type: "addon", status: true },
    { id: "rice_blood", name: "米血", price: 20, type: "addon", status: true },
    { id: "meatball", name: "貢丸", price: 20, type: "addon", status: true },
    { id: "tofu_strips", name: "豆干絲", price: 20, type: "addon", status: true },
    { id: "seaweed", name: "海藻", price: 20, type: "addon", status: true },
    
    // 4. 清爽解膩：鮮蔬配菜 (vegetable)
    { id: "cucumber", name: "小黃瓜", price: 20, type: "vegetable", status: true },
    { id: "cabbage", name: "高麗菜", price: 20, type: "vegetable", status: true },
    { id: "water_lotus", name: "水蓮", price: 20, type: "vegetable", status: true },
    { id: "lotus_root", name: "蓮藕", price: 20, type: "vegetable", status: true },
    { id: "asparagus_fern", name: "龍鬚菜", price: 20, type: "vegetable", status: true },
    { id: "water_bamboo", name: "筊白筍", price: 20, type: "vegetable", status: true },
    { id: "celery", name: "芹菜", price: 20, type: "vegetable", status: true },
    { id: "baby_corn", name: "玉米筍", price: 20, type: "vegetable", status: true },
    { id: "peanut", name: "花生", price: 20, type: "vegetable", status: true },
    { id: "onion", name: "洋蔥", price: 20, type: "vegetable", status: true },
    { id: "black_fungus", name: "木耳", price: 20, type: "vegetable", status: true },
    { id: "baby_cabbage", name: "娃娃菜", price: 20, type: "vegetable", status: true },
    { id: "long_bean", name: "長豆", price: 20, type: "vegetable", status: true },
    { id: "broccoli", name: "花椰菜", price: 20, type: "vegetable", status: true },
    { id: "chives", name: "韭菜", price: 20, type: "vegetable", status: true },
    { id: "bell_pepper", name: "甜椒", price: 20, type: "vegetable", status: true },
    { id: "chinese_kale", name: "芥蘭", price: 20, type: "vegetable", status: true },
    { id: "chayote", name: "佛手瓜", price: 20, type: "vegetable", status: true },
    { id: "king_oyster_mushroom", name: "杏鮑菇", price: 20, type: "vegetable", status: true },
    { id: "enoki_mushroom", name: "金針菇", price: 20, type: "vegetable", status: true },
    { id: "bitter_gourd", name: "苦瓜", price: 20, type: "vegetable", status: true },
    { id: "potato", name: "馬鈴薯", price: 20, type: "vegetable", status: true }
];

// 輔助函數：限制 Promise 執行時間，防止卡死
function withTimeout(promise, ms, timeoutErrorMsg) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(timeoutErrorMsg || "操作超時"));
        }, ms);
    });
    return Promise.race([
        promise.then(val => {
            clearTimeout(timeoutId);
            return val;
        }),
        timeout
    ]);
}

class DatabaseAdapter {
    constructor() {
        this.isFirebaseEnabled = false;
        this.db = null;
        this.init();
    }

    init() {
        // 檢查是否配置了 Firebase 憑證且 firebase 全域變數存在
        const hasConfig = SYSTEM_CONFIG.firebaseConfig && 
                          SYSTEM_CONFIG.firebaseConfig.apiKey && 
                          SYSTEM_CONFIG.firebaseConfig.apiKey !== "";
        
        if (hasConfig && typeof firebase !== 'undefined') {
            try {
                // 防止重複初始化
                if (!firebase.apps.length) {
                    firebase.initializeApp(SYSTEM_CONFIG.firebaseConfig);
                }
                this.db = firebase.firestore();
                this.isFirebaseEnabled = true;
                console.log("Firebase Firestore 初始化成功，使用雲端資料庫。");
            } catch (error) {
                console.error("Firebase 初始化失敗，自動降級至 LocalStorage 模擬模式。", error);
                this.isFirebaseEnabled = false;
            }
        } else {
            console.log("未配置 Firebase 或未載入 SDK，啟用 LocalStorage 模擬模式。");
            this.isFirebaseEnabled = false;
        }

        // 初始化本地模擬資料
        if (!this.isFirebaseEnabled) {
            this.initLocalStorage();
        }
    }

    initLocalStorage() {
        const localMenu = localStorage.getItem('rong_menu');
        let needsReset = false;
        
        if (localMenu) {
            try {
                const parsed = JSON.parse(localMenu);
                // 檢測是否有舊的 "side" 類型品項，或缺失 "chicken_skin"，或 "egg_yolk" 仍屬 addon 分類
                const hasSide = parsed.some(item => item.type === "side");
                const hasChickenSkin = parsed.some(item => item.id === "chicken_skin");
                const isEggYolkAddon = parsed.some(item => item.id === "egg_yolk" && item.type === "addon");
                
                if (hasSide || !hasChickenSkin || isEggYolkAddon) {
                    needsReset = true;
                }
            } catch (e) {
                needsReset = true;
            }
        } else {
            needsReset = true;
        }

        if (needsReset) {
            console.log("偵測到舊版菜單格式，執行 LocalStorage 自動升級重設...");
            localStorage.setItem('rong_menu', JSON.stringify(DEFAULT_MENU));
        }

        if (localStorage.getItem('rong_drumstick_quota') === null) {
            localStorage.setItem('rong_drumstick_quota', String(SYSTEM_CONFIG.defaultDrumstickQuota));
        }
        if (!localStorage.getItem('rong_orders')) {
            localStorage.setItem('rong_orders', JSON.stringify([]));
        }
        if (!localStorage.getItem('rong_system_status')) {
            localStorage.setItem('rong_system_status', JSON.stringify({ isRestDay: false, isPaused: false }));
        }
    }

    // 取得所有菜單品項
    async getMenu() {
        if (this.isFirebaseEnabled) {
            try {
                const snapshot = await withTimeout(this.db.collection('menu').get(), 4000, "取得菜單超時");
                if (snapshot.empty) {
                    // 若 Firestore 是空的，則上傳預設菜單並回傳
                    console.log("Firestore 菜單為空，開始初始化預設菜單...");
                    const batch = this.db.batch();
                    DEFAULT_MENU.forEach((item) => {
                        const ref = this.db.collection('menu').doc(item.id);
                        batch.set(ref, item);
                    });
                    await withTimeout(batch.commit(), 4000, "初始化菜單上傳超時");
                    return DEFAULT_MENU;
                }
                const menu = [];
                snapshot.forEach(doc => {
                    menu.push(doc.data());
                });
                return menu;
            } catch (error) {
                console.error("Firestore getMenu 失敗，自動降級至 LocalStorage", error);
                this.isFirebaseEnabled = false;
                return this.getLocalMenu();
            }
        } else {
            return this.getLocalMenu();
        }
    }

    getLocalMenu() {
        return JSON.parse(localStorage.getItem('rong_menu')) || DEFAULT_MENU;
    }

    // 更新菜單品項啟用狀態
    async updateMenuItemStatus(itemId, isOpen) {
        if (this.isFirebaseEnabled) {
            try {
                await withTimeout(this.db.collection('menu').doc(itemId).update({ status: isOpen }), 4000, "更新品項狀態超時");
                console.log(`已更新品項 ${itemId} 狀態為: ${isOpen}`);
            } catch (error) {
                console.error("Firestore updateMenuItemStatus 失敗，自動降級改更新 LocalStorage", error);
                this.isFirebaseEnabled = false;
                this.updateLocalMenuItemStatus(itemId, isOpen);
            }
        } else {
            this.updateLocalMenuItemStatus(itemId, isOpen);
        }
    }

    updateLocalMenuItemStatus(itemId, isOpen) {
        const menu = this.getLocalMenu();
        const item = menu.find(i => i.id === itemId);
        if (item) {
            item.status = isOpen;
            localStorage.setItem('rong_menu', JSON.stringify(menu));
        }
    }

    // 更新菜單品項價格
    async updateMenuItemPrice(itemId, newPrice) {
        newPrice = Number(newPrice);
        if (this.isFirebaseEnabled) {
            try {
                await withTimeout(this.db.collection('menu').doc(itemId).update({ price: newPrice }), 4000, "更新品項價格超時");
                console.log(`已更新品項 ${itemId} 價格為: ${newPrice}`);
            } catch (error) {
                console.error("Firestore updateMenuItemPrice 失敗，自動降級改更新 LocalStorage", error);
                this.isFirebaseEnabled = false;
                this.updateLocalMenuItemPrice(itemId, newPrice);
            }
        } else {
            this.updateLocalMenuItemPrice(itemId, newPrice);
        }
    }

    updateLocalMenuItemPrice(itemId, newPrice) {
        const menu = this.getLocalMenu();
        const item = menu.find(i => i.id === itemId);
        if (item) {
            item.price = newPrice;
            localStorage.setItem('rong_menu', JSON.stringify(menu));
        }
    }

    // 取得去骨雞腿剩餘配額
    async getDrumstickQuota() {
        if (this.isFirebaseEnabled) {
            try {
                const doc = await withTimeout(this.db.collection('settings').doc('drumstick_quota').get(), 4000, "取得雞腿配額超時");
                if (doc.exists) {
                    return doc.data().quota;
                } else {
                    // 初始化配額
                    await withTimeout(this.db.collection('settings').doc('drumstick_quota').set({ quota: SYSTEM_CONFIG.defaultDrumstickQuota }), 4000, "初始化雞腿配額超時");
                    return SYSTEM_CONFIG.defaultDrumstickQuota;
                }
            } catch (error) {
                console.error("Firestore getDrumstickQuota 失敗，自動降級至 LocalStorage", error);
                this.isFirebaseEnabled = false;
                return this.getLocalDrumstickQuota();
            }
        } else {
            return this.getLocalDrumstickQuota();
        }
    }

    getLocalDrumstickQuota() {
        const quota = localStorage.getItem('rong_drumstick_quota');
        return quota !== null ? parseInt(quota, 10) : SYSTEM_CONFIG.defaultDrumstickQuota;
    }

    // 更新去骨雞腿剩餘配額
    async updateDrumstickQuota(count) {
        if (this.isFirebaseEnabled) {
            try {
                await withTimeout(this.db.collection('settings').doc('drumstick_quota').update({ quota: count }), 4000, "更新雞腿配額超時");
                console.log(`已更新雞腿配額為: ${count}`);
            } catch (error) {
                console.error("Firestore updateDrumstickQuota 失敗，自動降級改更新 LocalStorage", error);
                this.isFirebaseEnabled = false;
                this.updateLocalDrumstickQuota(count);
            }
        } else {
            this.updateLocalDrumstickQuota(count);
        }
    }

    updateLocalDrumstickQuota(count) {
        localStorage.setItem('rong_drumstick_quota', String(count));
    }

    // 寫入新訂單
    async createOrder(orderData) {
        if (this.isFirebaseEnabled) {
            try {
                await withTimeout(this.db.collection('orders').doc(orderData.id).set(orderData), 4000, "寫入新訂單超時");
                console.log(`訂單 ${orderData.id} 已寫入 Firestore。`);
            } catch (error) {
                console.error("Firestore createOrder 失敗，自動降級寫入 LocalStorage", error);
                this.isFirebaseEnabled = false;
                this.createLocalOrder(orderData);
            }
        } else {
            this.createLocalOrder(orderData);
        }
    }

    createLocalOrder(orderData) {
        const orders = JSON.parse(localStorage.getItem('rong_orders')) || [];
        orders.push(orderData);
        localStorage.setItem('rong_orders', JSON.stringify(orders));
    }

    // 取得所有訂單 (供後台管理對帳使用)
    async getOrders() {
        if (this.isFirebaseEnabled) {
            try {
                const snapshot = await withTimeout(this.db.collection('orders').orderBy('createdAt', 'desc').get(), 4000, "取得訂單列表超時");
                const orders = [];
                snapshot.forEach(doc => {
                    orders.push(doc.data());
                });
                return orders;
            } catch (error) {
                console.error("Firestore getOrders 失敗，自動降級至 LocalStorage", error);
                this.isFirebaseEnabled = false;
                return this.getLocalOrders();
            }
        } else {
            return this.getLocalOrders();
        }
    }

    getLocalOrders() {
        const orders = JSON.parse(localStorage.getItem('rong_orders')) || [];
        // 按照時間倒序排序
        return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 取得今日訂單 (優化效能，避免拉取全部歷史訂單)
    async getTodayOrders(datePrefix) {
        if (this.isFirebaseEnabled) {
            try {
                // 利用 Firestore 範圍查詢篩選今日單號以 datePrefix 開頭的訂單
                const snapshot = await withTimeout(
                    this.db.collection('orders')
                        .where('id', '>=', datePrefix)
                        .where('id', '<=', datePrefix + '\uf8ff')
                        .get(),
                    4000,
                    "取得今日訂單超時"
                );
                const orders = [];
                snapshot.forEach(doc => {
                    orders.push(doc.data());
                });
                return orders;
            } catch (error) {
                console.error("Firestore getTodayOrders 失敗，自動降級至 LocalStorage", error);
                this.isFirebaseEnabled = false;
                return this.getLocalTodayOrders(datePrefix);
            }
        } else {
            return this.getLocalTodayOrders(datePrefix);
        }
    }

    getLocalTodayOrders(datePrefix) {
        const orders = this.getLocalOrders();
        return orders.filter(o => o.id && o.id.startsWith(datePrefix));
    }

    // 新增品項 (預設為配菜 type="side")
    async addMenuItem(name, price, type = "side") {
        const id = "side_" + Date.now().toString().slice(-6);
        const item = { id, name, price: Number(price), type, status: true };
        
        if (this.isFirebaseEnabled) {
            try {
                await withTimeout(this.db.collection('menu').doc(id).set(item), 4000, "新增品項超時");
                console.log(`已將品項 ${name} 新增至 Firestore`);
                return item;
            } catch (error) {
                console.error("Firestore addMenuItem 失敗，自動降級改用 LocalStorage", error);
                this.isFirebaseEnabled = false;
                return this.addLocalMenuItem(item);
            }
        } else {
            return this.addLocalMenuItem(item);
        }
    }

    addLocalMenuItem(item) {
        const menu = this.getLocalMenu();
        menu.push(item);
        localStorage.setItem('rong_menu', JSON.stringify(menu));
        return item;
    }

    // 刪除品項
    async deleteMenuItem(itemId) {
        if (this.isFirebaseEnabled) {
            try {
                await withTimeout(this.db.collection('menu').doc(itemId).delete(), 4000, "刪除品項超時");
                console.log(`已從 Firestore 刪除品項 ${itemId}`);
            } catch (error) {
                console.error("Firestore deleteMenuItem 失敗，自動降級改用 LocalStorage", error);
                this.isFirebaseEnabled = false;
                this.deleteLocalMenuItem(itemId);
            }
        } else {
            this.deleteLocalMenuItem(itemId);
        }
    }

    deleteLocalMenuItem(itemId) {
        const menu = this.getLocalMenu();
        const index = menu.findIndex(i => i.id === itemId);
        if (index !== -1) {
            menu.splice(index, 1);
            localStorage.setItem('rong_menu', JSON.stringify(menu));
        }
    }

    // 取得系統狀態（公休/暫停點餐）
    async getSystemStatus() {
        const defaultStatus = { isRestDay: false, isPaused: false };
        if (this.isFirebaseEnabled) {
            try {
                const doc = await withTimeout(this.db.collection('settings').doc('system_status').get(), 4000, "取得系統狀態超時");
                if (doc.exists) {
                    return doc.data();
                } else {
                    await withTimeout(this.db.collection('settings').doc('system_status').set(defaultStatus), 4000, "初始化系統狀態超時");
                    return defaultStatus;
                }
            } catch (error) {
                console.error("Firestore getSystemStatus 失敗，自動降級至 LocalStorage", error);
                this.isFirebaseEnabled = false;
                return this.getLocalSystemStatus();
            }
        } else {
            return this.getLocalSystemStatus();
        }
    }

    getLocalSystemStatus() {
        const status = localStorage.getItem('rong_system_status');
        return status ? JSON.parse(status) : { isRestDay: false, isPaused: false };
    }

    // 更新系統狀態
    async updateSystemStatus(isRestDay, isPaused) {
        const status = { isRestDay, isPaused };
        if (this.isFirebaseEnabled) {
            try {
                await withTimeout(this.db.collection('settings').doc('system_status').set(status, { merge: true }), 4000, "更新系統狀態超時");
                console.log("Firestore 系統狀態已更新：", status);
            } catch (error) {
                console.error("Firestore updateSystemStatus 失敗，自動降級改更新 LocalStorage", error);
                this.isFirebaseEnabled = false;
                this.updateLocalSystemStatus(isRestDay, isPaused);
            }
        } else {
            this.updateLocalSystemStatus(isRestDay, isPaused);
        }
    }

    updateLocalSystemStatus(isRestDay, isPaused) {
        localStorage.setItem('rong_system_status', JSON.stringify({ isRestDay, isPaused }));
    }
}

// 全域實例
const dbAdapter = new DatabaseAdapter();
