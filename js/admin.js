// 榮 鹽水雞點餐系統 - 後台管理邏輯

let menuItems = [];
let drumstickQuota = 5;

document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
    setupEventListeners();
});

// ====== 將原本的 checkAuthentication, handleLogin, handleLogout 替換成以下內容 ======

// 檢查是否已登入 (交由 Firebase Auth 自動監聽)
function checkAuthentication() {
    // Firebase 會自動記住登入狀態，就算重整網頁也不會登出
    firebase.auth().onAuthStateChanged((user) => {
        const authOverlay = document.getElementById("auth-overlay");
        const adminMain = document.getElementById("admin-main-container");
        
        if (user) {
            // 已登入
            authOverlay.style.display = "none";
            adminMain.style.display = "block";
            loadAdminData();
        } else {
            // 未登入
            authOverlay.style.display = "flex";
            adminMain.style.display = "none";
            // 確保元素存在再 focus
            const passInput = document.getElementById("admin-pass-input");
            if(passInput) passInput.focus();
        }
    });
}

// 執行密碼驗證登入
async function handleLogin() {
    const passInput = document.getElementById("admin-pass-input").value;
    const errorMsg = document.getElementById("auth-error-msg");
    const submitBtn = document.getElementById("auth-submit-btn");
    
    // 我們剛剛在 Firebase 建立的隱藏帳號
    const adminEmail = "liao@order.com"; 
    
    if (!passInput) return;

    submitBtn.innerText = "驗證中...";
    submitBtn.disabled = true;

    try {
        // 向 Firebase 雲端發起真實登入請求
        await firebase.auth().signInWithEmailAndPassword(adminEmail, passInput);
        
        errorMsg.style.display = "none";
        
        // 切換過場動畫
        document.getElementById("auth-overlay").classList.add("hide");
        setTimeout(() => {
            document.getElementById("auth-overlay").style.display = "none";
            document.getElementById("admin-main-container").style.display = "block";
            // loadAdminData() 會在 onAuthStateChanged 中被觸發，這裡不需重複呼叫
        }, 300);
        
    } catch (error) {
        console.error("登入失敗:", error);
        errorMsg.style.display = "block";
        const inputField = document.getElementById("admin-pass-input");
        inputField.value = "";
        inputField.focus();
    } finally {
        submitBtn.innerText = "驗證登入";
        submitBtn.disabled = false;
    }
}

// 登出後台
function handleLogout() {
    if (confirm("確定要登出後台系統嗎？")) {
        firebase.auth().signOut().then(() => {
            location.reload();
        });
    }
}

// 設定事件監聽器
function setupEventListeners() {
    // 登入相關
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    if (authSubmitBtn) {
        authSubmitBtn.addEventListener("click", handleLogin);
    }

    const passInput = document.getElementById("admin-pass-input");
    if (passInput) {
        passInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                handleLogin();
            }
        });
    }

    // 登出相關
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    // 雞腿配額保存
    const saveQuotaBtn = document.getElementById("save-quota-btn");
    if (saveQuotaBtn) {
        saveQuotaBtn.addEventListener("click", saveDrumstickQuota);
    }

    // 重新整理訂單
    const refreshBtn = document.getElementById("refresh-orders-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadOrders);
    }

    // 新增商品按鈕
    const addItemBtn = document.getElementById("add-item-btn");
    if (addItemBtn) {
        addItemBtn.addEventListener("click", addNewItem);
    }
}

// 載入後台所有資料
async function loadAdminData() {
    await loadQuota();
    await loadSystemStatus();
    await loadMenuOptions();
    await loadOrders();
}

// 1. 讀取並渲染雞腿配額
async function loadQuota() {
    try {
        drumstickQuota = await dbAdapter.getDrumstickQuota();
        document.getElementById("quota-val-input").value = drumstickQuota;
    } catch (e) {
        console.error("讀取配額失敗", e);
    }
}

// 載入系統營運狀態開關
async function loadSystemStatus() {
    try {
        const status = await dbAdapter.getSystemStatus();
        const restSwitch = document.getElementById("system-rest-switch");
        const pauseSwitch = document.getElementById("system-pause-switch");
        
        if (restSwitch) restSwitch.checked = status.isRestDay;
        if (pauseSwitch) pauseSwitch.checked = status.isPaused;
    } catch (e) {
        console.error("載入系統狀態失敗", e);
    }
}

// 變更系統營運狀態
window.handleSystemStatusChange = async function() {
    const isRestDay = document.getElementById("system-rest-switch").checked;
    const isPaused = document.getElementById("system-pause-switch").checked;
    
    try {
        await dbAdapter.updateSystemStatus(isRestDay, isPaused);
        console.log(`系統狀態已更新：公休=${isRestDay}, 暫停=${isPaused}`);
    } catch (e) {
        console.error("更新系統狀態失敗", e);
        alert("更新營運狀態失敗，請重試。");
        location.reload();
    }
}

// 前端調整配額輸入數值
window.adjustQuotaInput = function(delta) {
    const input = document.getElementById("quota-val-input");
    let val = parseInt(input.value, 10) || 0;
    val += delta;
    if (val < 0) val = 0;
    input.value = val;
}

// 儲存配額至資料庫
async function saveDrumstickQuota() {
    const input = document.getElementById("quota-val-input");
    const val = parseInt(input.value, 10) || 0;
    
    try {
        await dbAdapter.updateDrumstickQuota(val);
        alert(`去骨雞腿配額已更新為: ${val} 隻！`);
    } catch (e) {
        console.error("更新配額失敗", e);
        alert("更新配額失敗，請檢查資料庫連線。");
    }
}

// 2. 載入並渲染菜單開關 (例外庫存)
async function loadMenuOptions() {
    const mainContainer = document.getElementById("main-switch-list");
    const boneContainer = document.getElementById("bone-switch-list");
    const addonContainer = document.getElementById("addon-switch-list");
    const vegetableContainer = document.getElementById("vegetable-switch-list");
    
    if (!mainContainer || !boneContainer || !addonContainer || !vegetableContainer) return;

    try {
        menuItems = await dbAdapter.getMenu();
        
        // 清空所有容器
        mainContainer.innerHTML = "";
        boneContainer.innerHTML = "";
        addonContainer.innerHTML = "";
        vegetableContainer.innerHTML = "";

        // 1. 渲染主食 (無刪除功能)
        const mainItems = menuItems.filter(i => i.type === "main");
        if (mainItems.length === 0) {
            mainContainer.innerHTML = `<div class="no-orders-msg">無主食品項</div>`;
        } else {
            mainItems.forEach(item => {
                mainContainer.appendChild(createSwitchRow(item, false));
            });
        }

        // 2. 渲染啃骨 (有刪除功能)
        const boneItems = menuItems.filter(i => i.type === "bone");
        if (boneItems.length === 0) {
            boneContainer.innerHTML = `<div class="no-orders-msg">無啃骨品項</div>`;
        } else {
            boneItems.forEach(item => {
                boneContainer.appendChild(createSwitchRow(item, true));
            });
        }

        // 3. 渲染配料 (有刪除功能)
        const addonItems = menuItems.filter(i => i.type === "addon");
        if (addonItems.length === 0) {
            addonContainer.innerHTML = `<div class="no-orders-msg">無配料品項</div>`;
        } else {
            addonItems.forEach(item => {
                addonContainer.appendChild(createSwitchRow(item, true));
            });
        }

        // 4. 渲染蔬菜 (有刪除功能)
        const vegetableItems = menuItems.filter(i => i.type === "vegetable");
        if (vegetableItems.length === 0) {
            vegetableContainer.innerHTML = `<div class="no-orders-msg">無蔬菜品項</div>`;
        } else {
            vegetableItems.forEach(item => {
                vegetableContainer.appendChild(createSwitchRow(item, true));
            });
        }

    } catch (e) {
        console.error("載入菜單失敗", e);
        mainContainer.innerHTML = `<div class="no-orders-msg">載入失敗</div>`;
        boneContainer.innerHTML = `<div class="no-orders-msg">載入失敗</div>`;
        addonContainer.innerHTML = `<div class="no-orders-msg">載入失敗</div>`;
        vegetableContainer.innerHTML = `<div class="no-orders-msg">載入失敗</div>`;
    }
}

// 建立 Switch Row 的 HTML
function createSwitchRow(item, isSide = false) {
    const row = document.createElement("div");
    row.className = `switch-row ${item.status ? "" : "inactive"}`;
    row.id = `row-${item.id}`;

    row.innerHTML = `
        <div class="switch-info">
            <span class="switch-name">${item.name}</span>
            <div class="price-edit-container" style="display: flex; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--secondary); margin-top: 4px;">
                <span>$</span>
                <input type="number" class="price-input-field" value="${item.price}" 
                       style="width: 55px; background: rgba(0,0,0,0.05); border: 1px solid var(--glass-border); color: var(--secondary); text-align: center; border-radius: 4px; padding: 2px 4px; font-size: 0.8rem; outline: none;"
                       onchange="handleUpdatePrice('${item.id}', this.value)">
                <span>元</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
            ${isSide ? `
                <button class="delete-item-btn" onclick="handleDeleteItem('${item.id}', '${item.name}')" 
                        style="background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 5px; font-size: 1rem; transition: var(--transition);">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            ` : ""}
            <label class="switch">
                <input type="checkbox" id="switch-${item.id}" ${item.status ? "checked" : ""}>
                <span class="slider"></span>
            </label>
        </div>
    `;

    // 綁定 change 事件，直接更新資料庫
    const checkbox = row.querySelector(`#switch-${item.id}`);
    checkbox.addEventListener("change", async (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            row.classList.remove("inactive");
        } else {
            row.classList.add("inactive");
        }
        
        try {
            await dbAdapter.updateMenuItemStatus(item.id, isChecked);
        } catch (err) {
            console.error("修改狀態失敗", err);
            // 失敗則回滾 UI 狀態
            e.target.checked = !isChecked;
            if (!isChecked) row.classList.remove("inactive");
            else row.classList.add("inactive");
        }
    });

    return row;
}

// 3. 載入並渲染線上訂單列表
async function loadOrders() {
    const container = document.getElementById("orders-container");
    if (!container) return;

    container.innerHTML = `<div class="no-orders-msg"><i class="fa-solid fa-spinner fa-spin"></i> 載入訂單中...</div>`;

    try {
        const orders = await dbAdapter.getOrders();
        container.innerHTML = "";

        // 過濾出今日凌晨起產生的訂單
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayOrders = orders.filter(order => new Date(order.createdAt) >= todayStart);

        if (todayOrders.length === 0) {
            container.innerHTML = `<div class="no-orders-msg">目前尚無今日線上訂單紀錄</div>`;
            return;
        }

        // 渲染今日訂單
        todayOrders.forEach(order => {
            const itemElement = document.createElement("div");
            itemElement.className = "order-admin-item";

            // 計算訂單總計包數
            const bagCount = order.bags.length;
            
            // 轉換並格式化時間，以本地時區顯示
            const orderDate = new Date(order.createdAt);
            const dateStr = `${orderDate.getMonth() + 1}/${orderDate.getDate()} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`;

            // 生成包包詳情
            let bagsHtml = "";
            order.bags.forEach(bag => {
                const itemDetails = bag.items.map(i => `${i.name} x${i.qty}`).join("、");
                // 判斷是否包含半隻
                const hasHalfChicken = bag.items.some(i => i.name.includes("半隻"));
                const hasBamboo = bag.hasGift || hasHalfChicken;
                const customText = formatCustomizationText(bag.spicy, bag.removes, hasBamboo);
                bagsHtml += `
                    <div class="order-bag-detail">
                        <div class="order-bag-title-row">
                            <span>第 ${bag.bagIndex} 包 ${bag.hasGift ? "🎁 (贈脆筍)" : ""}</span>
                            <span>$${bag.total} 元</span>
                        </div>
                        <div class="order-bag-items">▪ 食材：${itemDetails}</div>
                        <div class="order-bag-custom">▪ 調味：${customText}</div>
                        ${bag.note ? `<div class="order-bag-note">▪ 備註：${bag.note}</div>` : ""}
                    </div>
                `;
            });

            itemElement.innerHTML = `
                <div class="order-header-row">
                    <div class="order-meta-info">
                        <span class="order-id-badge">單號: ${order.id}</span>
                        <span class="order-time-badge">取餐時間: ${order.pickupTime}</span>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">下單: ${dateStr}</span>
                    </div>
                    <div class="order-total-badge">總計: $${order.totalAmount} 元</div>
                </div>
                <div style="margin-bottom: 12px; font-size: 0.9rem;">
                    👤 <b>顧客姓名：</b>${order.customerName} | 
                    📞 <b>聯絡電話：</b><a href="tel:${order.customerPhone}" class="order-admin-phone">${order.customerPhone}</a> 
                    <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 10px;">(共 ${bagCount} 包)</span>
                </div>
                <div class="order-bags-wrapper">
                    ${bagsHtml}
                </div>
            `;

            container.appendChild(itemElement);
        });

    } catch (e) {
        console.error("載入訂單失敗", e);
        container.innerHTML = `<div class="no-orders-msg">載入訂單發生錯誤，請重試。</div>`;
    }
}

// 格式化調味文字的輔助函式
function formatCustomizationText(spicy, removes, hasBamboo = false) {
    const defaultAdditions = {
        no_pepper: "要胡椒",
        no_oil: "要油",
        no_soup: "要高湯",
        no_onion: "要蔥"
    };

    const mapping = {
        no_pepper: "不要胡椒",
        no_oil: "不要油",
        no_soup: "不要加高湯",
        no_onion: "不要加蔥",
        no_bamboo: "不要脆筍"
    };

    const parts = [spicy];
    ["no_pepper", "no_oil", "no_soup", "no_onion"].forEach(key => {
        if (removes.includes(key)) {
            parts.push(mapping[key]);
        } else {
            let text = defaultAdditions[key];
            if (key === "no_soup") text = "要高湯";
            if (key === "no_onion") text = "要蔥";
            parts.push(text);
        }
    });

    // 處理脆筍邏輯
    if (removes.includes("no_bamboo")) {
        parts.push("不要脆筍");
    } else if (hasBamboo) {
        parts.push("要脆筍");
    }

    return parts.join(" / ");
}

// 新增自訂商品
async function addNewItem() {
    const nameInput = document.getElementById("new-item-name");
    const priceInput = document.getElementById("new-item-price");
    const typeSelect = document.getElementById("new-item-type");
    
    if (!nameInput || !priceInput || !typeSelect) return;
    
    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value, 10);
    const type = typeSelect.value; // 'addon' 或 'vegetable'
    
    if (!name) {
        alert("請輸入商品名稱！");
        return;
    }
    
    if (isNaN(price) || price < 0) {
        alert("請輸入有效的價格！");
        return;
    }
    
    const typeLabel = type === "addon" ? "配料" : (type === "bone" ? "內臟" : "蔬菜");
    
    try {
        await dbAdapter.addMenuItem(name, price, type);
        nameInput.value = "";
        priceInput.value = "20";
        await loadMenuOptions();
        alert(`自訂${typeLabel}「${name}」已成功新增！`);
    } catch (e) {
        console.error("新增商品失敗", e);
        alert("新增商品失敗，請重試。");
    }
}

// 刪除配菜
window.handleDeleteItem = async function(itemId, itemName) {
    if (!confirm(`確定要刪除品項「${itemName}」嗎？\n刪除後顧客點餐前台也將同步移除此品項。`)) {
        return;
    }
    
    try {
        await dbAdapter.deleteMenuItem(itemId);
        await loadMenuOptions();
        alert(`配菜「${itemName}」已成功刪除！`);
    } catch (e) {
        console.error("刪除配菜失敗", e);
        alert("刪除配菜失敗，請重試。");
    }
}

// 調整品項價格
window.handleUpdatePrice = async function(itemId, newPrice) {
    const price = parseInt(newPrice, 10);
    if (isNaN(price) || price < 0) {
        alert("請輸入有效的價格！");
        return;
    }
    
    try {
        await dbAdapter.updateMenuItemPrice(itemId, price);
        const item = menuItems.find(i => i.id === itemId);
        if (item) item.price = price;
        console.log(`價格更新成功：品項ID ${itemId} 新價格 $${price}`);
    } catch (e) {
        console.error("更新價格失敗", e);
        alert("更新價格失敗，請重試。");
    }
}
