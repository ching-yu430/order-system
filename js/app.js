// 榮 鹽水雞點餐系統 - 顧客端點餐邏輯

// 點餐狀態
let menu = [];
let drumstickQuota = 5;
let bags = [];
let activeBagIndex = 0;
let systemStatus = { isRestDay: false, isPaused: false };

// 初始化頁面
document.addEventListener("DOMContentLoaded", async () => {
    // 進站先檢查是否有未完成的号碼牌
    if (checkPendingTicket()) return; // 如果顯示号碼牌，不需載入其他資料

    await loadInitialData();
    initBags();
    renderTabs();
    renderActiveBag();
    initTimeOptions();
    setupEventListeners();
    renderSystemStatusUI();
});

// 載入資料庫資料
async function loadInitialData() {
    try {
        menu = await dbAdapter.getMenu();
        drumstickQuota = await dbAdapter.getDrumstickQuota();
        systemStatus = await dbAdapter.getSystemStatus();
        
        // 更新雞腿配額 UI
        updateQuotaUI();
    } catch (error) {
        console.error("載入初始資料失敗:", error);
    }
}

// 初始化分包
function initBags() {
    bags = [createEmptyBag()];
    activeBagIndex = 0;
}

// 建立空的包包對象
function createEmptyBag() {
    return {
        items: {}, // key: itemId, value: 數量
        spicy: "不辣", // 預設不辣
        removes: [], // 排除的配料，如: ["no_pepper", "no_oil", "no_soup", "no_onion"]
        note: "" // 個別備註
    };
}

// 更新雞腿配額顯示與進度條
function updateQuotaUI() {
    const quotaDisplay = document.getElementById("drumstick-quota-display");
    const quotaBar = document.getElementById("drumstick-quota-bar");
    
    if (quotaDisplay && quotaBar) {
        quotaDisplay.innerText = `${drumstickQuota} 隻`;
        
        // 滿額為 5 隻
        const percentage = Math.max(0, Math.min(100, (drumstickQuota / SYSTEM_CONFIG.defaultDrumstickQuota) * 100));
        quotaBar.style.width = `${percentage}%`;
        
        // 根據配額調整顏色
        if (drumstickQuota <= 1) {
            quotaBar.style.background = "var(--accent-red)";
            quotaDisplay.style.color = "var(--accent-red)";
        } else if (drumstickQuota <= 3) {
            quotaBar.style.background = "var(--secondary)";
            quotaDisplay.style.color = "var(--secondary)";
        } else {
            quotaBar.style.background = "linear-gradient(to right, var(--secondary), var(--primary))";
            quotaDisplay.style.color = "var(--primary)";
        }
    }
}

// 渲染分包頁籤
function renderTabs() {
    const tabsList = document.getElementById("bag-tabs-list");
    if (!tabsList) return;

    tabsList.innerHTML = "";
    bags.forEach((bag, index) => {
        const tabBtn = document.createElement("button");
        tabBtn.className = `tab-btn ${index === activeBagIndex ? "active" : ""}`;
        tabBtn.setAttribute("data-bag-index", index);
        
        // 計算該包點的數量
        let totalItems = 0;
        for (let id in bag.items) {
            totalItems += bag.items[id];
        }

        const tabText = document.createElement("span");
        tabText.innerText = `第 ${index + 1} 包 ${totalItems > 0 ? `(${totalItems})` : ""}`;
        tabBtn.appendChild(tabText);

        // 如果包包多於一包，允許刪除
        if (bags.length > 1) {
            const closeBtn = document.createElement("span");
            closeBtn.className = "tab-close-btn";
            closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // 阻止觸發切換頁籤
                deleteBag(index);
            });
            tabBtn.appendChild(closeBtn);
        }

        tabBtn.addEventListener("click", () => {
            switchTab(index);
        });

        tabsList.appendChild(tabBtn);
    });
}

// 切換頁籤
function switchTab(index) {
    activeBagIndex = index;
    renderTabs();
    renderActiveBag();
}

// 新增分包
function addBag() {
    bags.push(createEmptyBag());
    activeBagIndex = bags.length - 1;
    renderTabs();
    renderActiveBag();
    updateGrandTotal();
}

// 刪除分包
function deleteBag(index) {
    if (bags.length <= 1) return;
    
    bags.splice(index, 1);
    
    // 調整當前啟動的頁籤索引，防溢出
    if (activeBagIndex >= bags.length) {
        activeBagIndex = bags.length - 1;
    }
    
    renderTabs();
    renderActiveBag();
    updateGrandTotal();
}

// 渲染當前選中包的內容
function renderActiveBag() {
    const container = document.getElementById("bag-content-container");
    if (!container) return;

    const currentBag = bags[activeBagIndex];
    
    // 計算單包滿額贈
    const giftStatus = checkGiftEligibility(currentBag);

    // 區分四大分類
    const mainItems = menu.filter(item => item.type === "main" && item.status);
    const boneItems = menu.filter(item => item.type === "bone" && item.status);
    const addonItems = menu.filter(item => item.type === "addon" && item.status);
    const vegetableItems = menu.filter(item => item.type === "vegetable" && item.status);

    let html = `
        <div class="bag-panel-header">
            <div class="bag-title">
                <i class="fa-solid fa-bag-shopping"></i> 
                <span>第 ${activeBagIndex + 1} 包 點餐清單</span>
            </div>
        </div>

        <!-- 1. 招牌飽足：主食雞肉 -->
        <div class="category-title" id="cat-main">
            <i class="fa-solid fa-drumstick-bite"></i> 1. 【🌟 招牌飽足：主食雞肉】
        </div>
        <div class="items-grid">
            ${mainItems.map(item => renderItemCard(item, currentBag)).join("")}
        </div>

        <!-- 2. 越嚼越香：啃骨與內臟 -->
        <div class="category-title" id="cat-bone">
            <i class="fa-solid fa-bone"></i> 2. 【🦴 越嚼越香：啃骨與內臟】
        </div>
        <div class="items-grid">
            ${boneItems.length > 0 ? boneItems.map(item => renderItemCard(item, currentBag)).join("") : '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 15px; font-size: 0.9rem;">目前無此類品項</div>'}
        </div>

        <!-- 3. 經典必點：人氣配料 -->
        <div class="category-title" id="cat-addon">
            <i class="fa-solid fa-pizza-slice"></i> 3. 【🍢 經典必點：人氣配料】
        </div>
        <div class="items-grid">
            ${addonItems.length > 0 ? addonItems.map(item => renderItemCard(item, currentBag)).join("") : '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 15px; font-size: 0.9rem;">目前無此類品項</div>'}
        </div>

        <!-- 4. 清爽解膩：鮮蔬配菜 -->
        <div class="category-title" id="cat-vegetable">
            <i class="fa-solid fa-seedling"></i> 4. 【🥬 清爽解膩：鮮蔬配菜】
        </div>
        <div class="items-grid">
            ${vegetableItems.length > 0 ? vegetableItems.map(item => renderItemCard(item, currentBag)).join("") : '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 15px; font-size: 0.9rem;">目前無此類品項</div>'}
        </div>

        <!-- 調味客製化 -->
        <div class="customization-section">
            <div class="cust-row">
                <span class="cust-label"><i class="fa-solid fa-pepper-hot"></i> 辣度選擇 <span>(單選)</span></span>
                <div class="btn-group">
                    ${["不辣", "微辣", "小辣", "中辣", "大辣"].map(spicy => `
                        <label>
                            <input type="radio" name="spicy-${activeBagIndex}" class="radio-btn" value="${spicy}" 
                                   ${currentBag.spicy === spicy ? "checked" : ""} onchange="updateSpicy('${spicy}')">
                            <span class="btn-option" data-spicy="${spicy}">${spicy}</span>
                        </label>
                    `).join("")}
                </div>
            </div>

            <div class="cust-row">
                <span class="cust-label">
                    <i class="fa-solid fa-mortar-pestle"></i> 配料調整 <span>(複選，不要的請勾選)</span>
                    <span id="gift-indicator-${activeBagIndex}" class="gift-indicator" style="margin-left: 10px; font-size: 0.8rem; font-weight: 700; color: ${giftStatus.eligible ? 'var(--secondary)' : 'var(--text-muted)'};">
                        ${giftStatus.eligible ? '單包已滿$100贈送脆筍' : '(單包滿 $100 贈脆筍)'}
                    </span>
                </span>
                <div class="btn-group">
                    ${[
                        { id: "no_pepper", label: "不要胡椒" },
                        { id: "no_oil", label: "不要油" },
                        { id: "no_soup", label: "不要加高湯" },
                        { id: "no_onion", label: "不要加蔥" },
                        { id: "no_bamboo", label: "不加脆筍" }
                    ].map(remove => `
                        <label>
                            <input type="checkbox" class="checkbox-btn" value="${remove.id}" 
                                   ${currentBag.removes.includes(remove.id) ? "checked" : ""} onchange="toggleRemove('${remove.id}')">
                            <span class="btn-option">${remove.label}</span>
                        </label>
                    `).join("")}
                </div>
            </div>

            <div class="cust-row">
                <label for="bag-note-${activeBagIndex}" class="cust-label">
                    <i class="fa-solid fa-comment-dots"></i> 備註事項
                </label>
                <textarea id="bag-note-${activeBagIndex}" class="note-textarea" 
                          placeholder="本店僅雞腿去骨，其他肉類恕不去骨，請見諒" 
                          oninput="updateNote(this.value)">${currentBag.note}</textarea>
            </div>
        </div>

        <div class="bag-summary-row">
            <div class="bag-total">
                本包小計: <strong id="bag-total-display">$ ${calculateBagTotal(currentBag)} 元</strong>
            </div>
        </div>
    `;

    container.innerHTML = html;
    updateCategoryNavCounts();
}

// 渲染單個品項卡片
function renderItemCard(item, currentBag) {
    const qty = currentBag.items[item.id] || 0;
    const isSelected = qty > 0;
    
    // 檢查雞腿配額完售狀態
    let isSoldOut = false;
    if (item.id === "chicken_drumstick" && drumstickQuota <= 0) {
        isSoldOut = true;
    }

    return `
        <div class="item-card ${item.type} ${isSelected ? "selected" : ""} ${isSoldOut ? "sold-out" : ""}" 
             onclick="handleCardClick('${item.id}', ${isSoldOut})">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-price ${item.price === 20 ? 'highlight-price' : ''}">$${item.price}</div>
            </div>
            
            ${!isSoldOut ? `
                <div class="quantity-control" onclick="event.stopPropagation();">
                    <button class="qty-btn" onclick="adjustQty('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-value" id="qty-${item.id}">${qty}</span>
                    <button class="qty-btn" onclick="adjustQty('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
            ` : ""}
        </div>
    `;
}

// 點擊品項卡片 (整張卡片點擊時：若是 0 則設為 1，若是 >0 則取消選擇)
function handleCardClick(itemId, isSoldOut) {
    if (isSoldOut) return;
    
    const currentBag = bags[activeBagIndex];
    const currentQty = currentBag.items[itemId] || 0;
    
    if (currentQty === 0) {
        adjustQty(itemId, 1);
    } else {
        // 點擊已經選的品項之後取消選擇（數量歸零）
        adjustQty(itemId, -currentQty);
    }
}

// 調整單品項數量
function adjustQty(itemId, delta) {
    const currentBag = bags[activeBagIndex];
    const currentQty = currentBag.items[itemId] || 0;
    let newQty = currentQty + delta;
    
    if (newQty < 0) newQty = 0;
    
    // 雞腿數量限制防超賣
    if (itemId === "chicken_drumstick" && delta > 0) {
        // 計算整張訂單內所有包包點「去骨雞腿」的總合
        const totalDrumsticksOrdered = bags.reduce((sum, b, idx) => {
            // 如果是當前編輯包，先用新數量算；其餘包用原本的數量
            const q = (idx === activeBagIndex) ? newQty : (b.items["chicken_drumstick"] || 0);
            return sum + q;
        }, 0);
        
        if (totalDrumsticksOrdered > drumstickQuota) {
            alert(`很抱歉！今日去骨雞腿賸餘配額僅剩 ${drumstickQuota} 隻，無法再新增。`);
            return;
        }
    }
    
    if (newQty === 0) {
        delete currentBag.items[itemId];
    } else {
        currentBag.items[itemId] = newQty;
    }
    
    // 重新更新該品項的 UI 與小計
    const qtySpan = document.getElementById(`qty-${itemId}`);
    const card = qtySpan ? qtySpan.closest(".item-card") : null;
    if (qtySpan) qtySpan.innerText = newQty;
    
    if (card) {
        if (newQty > 0) {
            card.classList.add("selected");
        } else {
            card.classList.remove("selected");
        }
    }
    
    // 更新標籤數量提示
    renderTabs();
    
    // 更新單包小計
    const bagTotalDisplay = document.getElementById("bag-total-display");
    if (bagTotalDisplay) {
        bagTotalDisplay.innerText = `$ ${calculateBagTotal(currentBag)} 元`;
    }
    
    // 滿額贈即時判定
    const giftStatus = checkGiftEligibility(currentBag);
    const giftIndicator = document.getElementById(`gift-indicator-${activeBagIndex}`);
    
    if (giftIndicator) {
        if (giftStatus.eligible) {
            giftIndicator.innerText = '單包已滿$100贈送脆筍';
            giftIndicator.style.color = 'var(--secondary)';
        } else {
            giftIndicator.innerText = '(單包滿 $100 贈脆筍)';
            giftIndicator.style.color = 'var(--text-muted)';
        }
    }
    
    // 更新全訂單總金額
    updateGrandTotal();
    updateCategoryNavCounts();
}

// 辣度更新
function updateSpicy(val) {
    bags[activeBagIndex].spicy = val;
}

// 配料更新
function toggleRemove(removeId) {
    const currentBag = bags[activeBagIndex];
    const index = currentBag.removes.indexOf(removeId);
    if (index === -1) {
        currentBag.removes.push(removeId);
    } else {
        currentBag.removes.splice(index, 1);
    }
}

// 備註更新
function updateNote(val) {
    bags[activeBagIndex].note = val;
}

// 計算單包總額
function calculateBagTotal(bag) {
    let total = 0;
    for (let id in bag.items) {
        const qty = bag.items[id];
        const item = menu.find(m => m.id === id);
        if (item) {
            total += item.price * qty;
        }
    }
    return total;
}

// 滿額贈判定規則：單包消費金額扣除「半隻」品項後，滿 100 元贈送脆筍
function checkGiftEligibility(bag) {
    let eligibleAmount = 0;
    for (let id in bag.items) {
        if (id === "half_chicken") continue; // 排除半隻
        
        const qty = bag.items[id];
        const item = menu.find(m => m.id === id);
        if (item) {
            eligibleAmount += item.price * qty;
        }
    }
    return {
        eligible: eligibleAmount >= 100,
        amount: eligibleAmount
    };
}

// 更新整筆訂單大計，同步更新底部懸浮結帳條
function updateGrandTotal() {
    const grandTotal = bags.reduce((sum, bag) => sum + calculateBagTotal(bag), 0);
    
    // 更新結帳區金額顯示
    const grandTotalDisplay = document.getElementById("grand-total-price");
    if (grandTotalDisplay) {
        grandTotalDisplay.innerText = `$ ${grandTotal} 元`;
    }
    
    // 同步更新 Sticky Footer 金額
    const stickyPrice = document.getElementById("sticky-total-price");
    if (stickyPrice) {
        stickyPrice.innerText = `$ ${grandTotal} 元`;
    }
    
    // 控制 sticky bar 顯示（手機版，有品項時才顯示）
    updateStickyBarVisibility(grandTotal);
}

// 控制底部懸浮結帳條的顯示/隱藏
function updateStickyBarVisibility(grandTotal) {
    const bar = document.getElementById("sticky-checkout-bar");
    if (!bar) return;
    
    // 桌機版 (>= 768px) 不顯示
    if (window.innerWidth >= 768) {
        bar.classList.remove("visible");
        document.body.classList.remove("has-sticky-bar");
        return;
    }
    
    // 手機版：有點餐品項才顯示
    if (grandTotal > 0) {
        bar.classList.add("visible");
        document.body.classList.add("has-sticky-bar");
    } else {
        bar.classList.remove("visible");
        document.body.classList.remove("has-sticky-bar");
    }
}

// 初始化預計取餐時間選項 (每 15 分鐘一格，自動加入 25 分鐘備餐緩衝，過濾過去時間)
function initTimeOptions() {
    const select = document.getElementById("pickup-time");
    if (!select) return;
    
    select.innerHTML = '<option value="">請選擇取餐時間</option>';
    
    const now = new Date();
    
    // 加上 25 分鐘備餐緩衝
    const minPickupTime = new Date(now.getTime() + 25 * 60 * 1000);
    
    // 預約取餐時間 15:30 - 21:00
    // 15:30 = 15 * 60 + 30 = 930 分鐘
    // 21:00 = 21 * 60 = 1260 分鐘
    const startMinutes = 15 * 60 + 30;
    const endMinutes = 21 * 60;
    
    // 生成時間點
    for (let totalMins = startMinutes; totalMins <= endMinutes; totalMins += 15) {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        
        const timeOption = new Date();
        timeOption.setHours(h, m, 0, 0);
        
        // 必須晚於 (目前時間 + 25分鐘)
        if (timeOption >= minPickupTime) {
            const hourStr = String(h).padStart(2, '0');
            const minStr = String(m).padStart(2, '0');
            const timeStr = `${hourStr}:${minStr}`;
            
            const opt = document.createElement("option");
            opt.value = timeStr;
            opt.innerText = timeStr;
            select.appendChild(opt);
        }
    }
    
    // 如果生成出的選項數量為 0，代表此時已過預約時間，提供隔天的選項或是提示
    if (select.options.length <= 1) {
        const opt = document.createElement("option");
        opt.value = "tomorrow";
        opt.innerText = "今日已過可預約時間 (預約時間：15:30 - 21:00)";
        opt.disabled = true;
        select.appendChild(opt);
    }
}

// 設定基本事件監聽
function setupEventListeners() {
    const addBagBtn = document.getElementById("add-bag-btn");
    if (addBagBtn) {
        addBagBtn.addEventListener("click", addBag);
    }

    const submitBtn = document.getElementById("submit-order-btn");
    if (submitBtn) {
        submitBtn.addEventListener("click", submitOrder);
    }

    const clearBtn = document.getElementById("clear-order-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearOrder);
    }

    const closeModalBtn = document.getElementById("close-modal-btn");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", resetOrderSystem);
    }
    
    // 窗口大小變化時重新評估 sticky bar 可見性
    window.addEventListener("resize", () => {
        const grandTotal = bags.reduce((sum, bag) => sum + calculateBagTotal(bag), 0);
        updateStickyBarVisibility(grandTotal);
    });
    
    // 點擊 Sticky bar 結帳按鈕 -> 卷動到結帳區
    const stickyCheckoutBtn = document.getElementById("sticky-checkout-btn");
    if (stickyCheckoutBtn) {
        stickyCheckoutBtn.addEventListener("click", () => {
            const target = document.getElementById("checkout-section-anchor");
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }
}

// 送出訂單
async function submitOrder() {
    // 系統狀態阻攔 (公休 / 暫停線上點餐)
    if (systemStatus.isRestDay) {
        alert("很抱歉！本店今日公休，暫停線上點餐與取餐服務。");
        return;
    }
    if (systemStatus.isPaused) {
        alert("很抱歉！目前店家現場繁忙，暫停線上點餐，可稍後重新整理網頁查看，謝謝。");
        return;
    }

    // 限制開放點餐時間為每日 15:00 - 20:30
    if (!isOrderTime()) {
        alert("很抱歉！目前非開放線上點餐時間。每日開放點餐時間為 15:00 - 20:30。");
        return;
    }

    const customerName = document.getElementById("customer-name").value.trim();
    const customerPhone = document.getElementById("customer-phone").value.trim();
    const pickupTime = document.getElementById("pickup-time").value;
    
    // 1. 基本防呆驗證
    if (!customerName) {
        alert("請填寫訂購人姓名！");
        return;
    }
    if (!customerPhone) {
        alert("請填寫聯絡電話！");
        return;
    }
    // 手機號碼格式簡單驗證
    const phoneRegex = /^09\d{8}$/;
    const phoneRegexWithHyphens = /^09\d{2}-\d{3}-\d{3}$/;
    if (!phoneRegex.test(customerPhone) && !phoneRegexWithHyphens.test(customerPhone)) {
        alert("手機號碼格式不正確，請輸入 10 碼行動電話 (例如: 0912345678 或 0912-345-678)");
        return;
    }
    if (!pickupTime) {
        alert("請選擇預計取餐時間！");
        return;
    }
    
    // 2. 檢查是否點了任何品項
    let totalItemsCount = 0;
    bags.forEach(bag => {
        for (let id in bag.items) {
            totalItemsCount += bag.items[id];
        }
    });
    
    if (totalItemsCount === 0) {
        alert("您的點餐袋是空的，請先挑選食材！");
        return;
    }

    // 3. 鎖定按鈕避免重複提交 (驗證一通過立即鎖定)
    const submitBtn = document.getElementById("submit-order-btn");
    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-text").innerText = "訂單處理中...";

    try {
        const totalDrumsticksOrdered = bags.reduce((sum, b) => sum + (b.items["chicken_drumstick"] || 0), 0);
        
        // 4. 重新從資料庫獲取最新配額
        const latestQuota = await dbAdapter.getDrumstickQuota();

        if (totalDrumsticksOrdered > latestQuota) {
            alert(`很抱歉！由於店家現場雞腿數量變動，目前招牌去骨雞腿賸餘配額為 ${latestQuota} 隻，您總共點了 ${totalDrumsticksOrdered} 隻，請調整您的點餐。`);
            drumstickQuota = latestQuota;
            updateQuotaUI();
            renderActiveBag();
            
            // 恢復提交按鈕
            submitBtn.disabled = false;
            submitBtn.querySelector(".btn-text").innerText = "確認送出訂單";
            return;
        }

        // 生成 Ryymmdd*** 格式流水號單號
        const nowTime = new Date();
        const yy = String(nowTime.getFullYear()).slice(-2);
        const mm = String(nowTime.getMonth() + 1).padStart(2, '0');
        const dd = String(nowTime.getDate()).padStart(2, '0');
        const datePrefix = `R${yy}${mm}${dd}`; // 例如 "R260528"
        
        // 5. 僅獲取今日訂單 (避免拉取全部歷史訂單，顯著提升效能)
        const todayOrders = await dbAdapter.getTodayOrders(datePrefix);
        let nextNum = 1;
        if (todayOrders.length > 0) {
            const nums = todayOrders.map(o => {
                const suffix = o.id.slice(datePrefix.length);
                const val = parseInt(suffix, 10);
                return isNaN(val) ? 0 : val;
            });
            nextNum = Math.max(...nums) + 1;
        }
        const orderId = datePrefix + String(nextNum).padStart(3, '0');

        // 6. 準備訂單資料
        const grandTotal = bags.reduce((sum, bag) => sum + calculateBagTotal(bag), 0);
        
        const formattedBags = bags.map((bag, index) => {
            const giftStatus = checkGiftEligibility(bag);
            const itemDetails = [];
            
            for (let id in bag.items) {
                const qty = bag.items[id];
                const item = menu.find(m => m.id === id);
                if (item) {
                    itemDetails.push({
                        itemId: id,
                        name: item.name,
                        qty: qty,
                        price: item.price
                    });
                }
            }
            
            return {
                bagIndex: index + 1,
                items: itemDetails,
                spicy: bag.spicy,
                removes: [...bag.removes],
                note: bag.note,
                hasGift: giftStatus.eligible,
                total: calculateBagTotal(bag)
            };
        });

        const orderData = {
            id: orderId,
            customerName,
            customerPhone,
            pickupTime,
            bags: formattedBags,
            totalAmount: grandTotal,
            createdAt: new Date().toISOString()
        };

        // 7. 扣除雞腿配額並寫入資料庫
        if (totalDrumsticksOrdered > 0) {
            const newQuota = latestQuota - totalDrumsticksOrdered;
            await dbAdapter.updateDrumstickQuota(newQuota);
            drumstickQuota = newQuota;
            updateQuotaUI();
        }

        await dbAdapter.createOrder(orderData);

        // 8. 存入 localStorage 並切換至數位號碼牌畫面 (優先執行，提供即時回應)
        saveTicketAndShow(orderData);

        // 9. 背景推送 Discord 通知 (非阻塞，不 await)
        sendDiscordNotification(orderData).catch(error => {
            console.error("背景發送 Discord Webhook 通知失敗:", error);
        });

    } catch (error) {
        console.error("送出訂單時發生錯誤:", error);
        alert("送出訂單失敗，請稍後再試。");
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-text").innerText = "確認送出訂單";
    }
}

// 格式化配料調味以符合展示與對帳需求
function formatCustomizationText(spicy, removes, hasBamboo = false) {
    // 預設要加的項目
    const defaultAdditions = {
        no_pepper: "要胡椒",
        no_oil: "要油",
        no_soup: "要高湯",
        no_onion: "要蔥"
    };

    // 被排除的項目改為「不要」
    const mapping = {
        no_pepper: "不要胡椒",
        no_oil: "不要油",
        no_soup: "不要加高湯",
        no_onion: "不要加蔥",
        no_bamboo: "不要脆筍"
    };

    const parts = [spicy];
    
    // 遍歷基本配料，如果有在 removes 內顯示「不要」，否則顯示「要」
    ["no_pepper", "no_oil", "no_soup", "no_onion"].forEach(key => {
        if (removes.includes(key)) {
            parts.push(mapping[key]);
        } else {
            let additionText = defaultAdditions[key];
            if (key === "no_soup") additionText = "要高湯";
            if (key === "no_onion") additionText = "要蔥";
            parts.push(additionText);
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

// 發送 Discord 通知 (調整版：依照最新廚房出餐單格式排版)
async function sendDiscordNotification(order) {
    if (!SYSTEM_CONFIG.discordWebhookUrl || SYSTEM_CONFIG.discordWebhookUrl === "") {
        console.log("未配置 Discord Webhook URL，跳過通知傳送。");
        return;
    }
    // 擷取單號後三碼變成純數字（例如：R260528014 -> 14）
    const sequenceNum = parseInt(order.id.slice(-3), 10) || order.id.slice(-3);
    
    // 最頂部格式
    let markdown = `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    markdown += `#  ⏰取餐【 ${order.pickupTime} 】 \n\n`;
    markdown += `## ${order.customerName} （${order.customerPhone}）${sequenceNum} 號\n\n`;
    markdown += `##  總計 $ ${order.totalAmount} 元 (共 ${order.bags.length} 包)  \n\n`;
    markdown += `### 單號：\`${order.id}\`\n\n\n`;
    markdown += `━━━━━━━━━━━━━━━━━━━━━━\n\n\n`;
    
    // 中間分包區
    order.bags.forEach(bag => {
        const giftText = bag.hasGift ? ` 🎉【滿百贈脆筍】` : ``;
        markdown += `###  【第 ${bag.bagIndex} 包】 ── $ ${bag.total} 元${giftText}\n\n`;
        markdown += `▪ 食材明細：\n\n`;
        
        // 食材明細使用 ## 與 🔸 表現較大字體
        const itemLines = bag.items.map(item => `##  🔸 ${item.qty} 份 ── ${item.name}`).join("\n\n");
        markdown += `${itemLines}\n\n\n`;
        
        // 調味客製邏輯 (只留辣度與不要的項目)
        const discordMapping = {
            no_pepper: "不要胡椒",
            no_oil: "不要油",
            no_soup: "不要高湯",
            no_onion: "不要蔥",
            no_bamboo: "不要脆筍"
        };
        
        let customParts = [bag.spicy];
        if (bag.removes && bag.removes.length > 0) {
            bag.removes.forEach(key => {
                if (discordMapping[key]) {
                    customParts.push(discordMapping[key]);
                }
            });
        }
        
        const cleanCustomText = customParts.join(" / ");
        markdown += `▪ 調味客製： \`${cleanCustomText}\`\n\n`;
        
        const noteText = bag.note.trim() !== "" ? `\`${bag.note}\`` : "無";
        markdown += `▪ 單包備註 : ${noteText}\n`;
        markdown += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });
    try {
        const response = await fetch(SYSTEM_CONFIG.discordWebhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: JSON.stringify({
                content: markdown
            })
        });
        if (!response.ok) {
            throw new Error(`Discord 中繼站回傳錯誤: ${response.status}`);
        }
        console.log("Discord 通知發送成功！");
    } catch (error) {
        console.error("發送 Discord 通知失敗:", error);
    }
}

// 顯示成功彈窗
function showSuccessModal(order) {
    const modal = document.getElementById("success-modal");
    const summary = document.getElementById("receipt-summary");
    
    if (modal && summary) {
        let receiptHtml = `
            <div class="receipt-header">
                <span>單號: ${order.id}</span>
                <span>取餐: ${order.pickupTime}</span>
            </div>
            <p><strong>顧客:</strong> ${order.customerName} (${order.customerPhone})</p>
            <div style="margin: 10px 0; border-top: 1px dashed rgba(255,255,255,0.1);"></div>
        `;

        order.bags.forEach(bag => {
            const itemNames = bag.items.map(item => `${item.name} x${item.qty}`).join("、");
            const hasBamboo = bag.hasGift || (bag.items && bag.items.some(i => i.itemId === "half_chicken"));
            const customText = formatCustomizationText(bag.spicy, bag.removes, hasBamboo);
            receiptHtml += `
                <div class="receipt-bag">
                    <div class="receipt-bag-title">第 ${bag.bagIndex} 包 ${bag.hasGift ? "(🎁 贈脆筍)" : ""}</div>
                    <div>• ${itemNames}</div>
                    <div style="color: var(--text-secondary); font-size: 0.8rem;">• ${customText}</div>
                    ${bag.note ? `<div style="color: var(--secondary); font-size: 0.8rem;">• 備註: ${bag.note}</div>` : ""}
                </div>
            `;
        });

        receiptHtml += `
            <div style="text-align: right; font-weight: 700; font-size: 1rem; color: var(--primary); margin-top: 10px;">
                總計金額: $${order.totalAmount} 元
            </div>
        `;

        summary.innerHTML = receiptHtml;
        modal.classList.add("open");
    }
}

// 關閉成功彈窗並重置系統
function resetOrderSystem() {
    const modal = document.getElementById("success-modal");
    if (modal) {
        modal.classList.remove("open");
    }

    // 重設狀態與 UI 欄位
    initBags();
    document.getElementById("customer-name").value = "";
    document.getElementById("customer-phone").value = "";
    
    // 重新載入最新資料 (以防其他人在期間買了雞腿)
    loadInitialData().then(() => {
        renderTabs();
        renderActiveBag();
        initTimeOptions();
        updateGrandTotal();
        
        // 恢復提交按鈕並依系統與時間檢查狀態
        renderSystemStatusUI();
    });
}

/* ================================================
   號碼牌系統 (Ticket System)
   ================================================ */

const TICKET_STORAGE_KEY = "rong_pending_order";

/**
 * 進站先檢查 localStorage 是否有待完成訂單
 * @returns {boolean} 是否顯示了号碼牌（true = 已顯示，主程式应停止載入點餐頁）
 */
function checkPendingTicket() {
    try {
        const raw = localStorage.getItem(TICKET_STORAGE_KEY);
        if (!raw) return false;

        const saved = JSON.parse(raw);
        const today = getTodayDateString();

        // 隔夜自動清除
        if (saved.savedDate !== today) {
            localStorage.removeItem(TICKET_STORAGE_KEY);
            console.log("[Ticket] 舊号碼牌已過期，自動清除。");
            return false;
        }

        // 有效訂單：直接顯示号碼牌
        showTicketView(saved.order);
        return true;
    } catch (e) {
        console.error("[Ticket] 讀取 localStorage 失敗:", e);
        localStorage.removeItem(TICKET_STORAGE_KEY);
        return false;
    }
}

/**
 * 存入 localStorage 並切換到号碼牌畫面
 */
function saveTicketAndShow(order) {
    try {
        const payload = {
            savedDate: getTodayDateString(),
            order: order
        };
        localStorage.setItem(TICKET_STORAGE_KEY, JSON.stringify(payload));
        console.log("[Ticket] 訂單已存入 localStorage。");
    } catch (e) {
        console.error("[Ticket] 寫入 localStorage 失敗:", e);
    }
    showTicketView(order);
}

/**
 * 顯示号碼牌畫面，隐藏點餐頁面
 */
function showTicketView(order) {
    // 隐藏點餐主區與底部懸浮條
    const orderMain = document.querySelector(".container");
    if (orderMain) orderMain.style.display = "none";
    const stickyBar = document.getElementById("sticky-checkout-bar");
    if (stickyBar) stickyBar.style.display = "none";
    const bgDecor = document.querySelector(".background-decor");
    // background-decor 保留，共用背景

    // 顯示号碼牌
    const ticketView = document.getElementById("ticket-view");
    if (ticketView) ticketView.classList.add("show");

    // 填入資料
    renderTicketData(order);

    // 卷動到頂部
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 將訂單資料渲染到号碼牌上
 */
function renderTicketData(order) {
    // 號碼：取單號後三碼
    const numEl = document.getElementById("ticket-number-display");
    if (numEl) {
        const numPart = order.id ? order.id.slice(-3) : "---";
        numEl.textContent = numPart;
    }

    // 取餐時間
    const timeEl = document.getElementById("ticket-time-display");
    if (timeEl) timeEl.textContent = order.pickupTime || "--:--";

    // 顧客姓名
    const nameEl = document.getElementById("ticket-name-display");
    if (nameEl) nameEl.textContent = order.customerName || "";

    // 單號
    const idEl = document.getElementById("ticket-order-id-display");
    if (idEl) idEl.textContent = `訂單編號：${order.id || "------"}`;

    // 訂單明細
    renderTicketDetail(order);
}

/**
 * 產生訂單明細內容
 */
function renderTicketDetail(order) {
    const body = document.getElementById("ticket-detail-body");
    if (!body) return;

    let html = "";
    (order.bags || []).forEach(bag => {
        const itemNames = (bag.items || []).map(i => `${i.name} ×${i.qty}`).join("、");
        const hasBamboo = bag.hasGift || (bag.items && bag.items.some(i => i.itemId === "half_chicken"));
        const customText = formatCustomizationText(bag.spicy, bag.removes || [], hasBamboo);

        html += `
            <div class="ticket-bag-row">
                <div class="ticket-bag-title">第 ${bag.bagIndex} 包 ${bag.hasGift ? "(\uD83C\uDF81 贈脆筍)" : ""}</div>
                <div class="ticket-bag-items">• ${itemNames || "未選擇品項"}</div>
                <div class="ticket-bag-custom">• ${customText}</div>
                ${bag.note ? `<div class="ticket-bag-note">• 備註：${bag.note}</div>` : ""}
            </div>
        `;
    });

    html += `
        <div class="ticket-total-row">
            <span>訂單總金額</span>
            <span class="ticket-total-amount">$ ${order.totalAmount} 元</span>
        </div>
    `;

    body.innerHTML = html;
}

/**
 * 切換訂單明細展開/收起
 */
function toggleTicketDetail() {
    const card = document.getElementById("ticket-detail-card");
    if (card) card.classList.toggle("expanded");
}

/**
 * 清除號碼牌並回到點餐菜單
 */
function clearTicketAndReset() {
    if (!confirm("確定要建立新訂單嗎？\n現有的號碼牌將被清除。")) return;

    // 清除 localStorage
    localStorage.removeItem(TICKET_STORAGE_KEY);

    // 隐藏号碼牌
    const ticketView = document.getElementById("ticket-view");
    if (ticketView) ticketView.classList.remove("show");

    // 顯示點餐主區
    const orderMain = document.querySelector(".container");
    if (orderMain) orderMain.style.display = "";

    // 初始化點餐頁面狀態
    loadInitialData().then(() => {
        initBags();
        renderTabs();
        renderActiveBag();
        initTimeOptions();
        updateGrandTotal();
        renderSystemStatusUI();
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 取得今日日期字串 (YYYY-MM-DD)
 */
function getTodayDateString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// 平滑滾動定位函數
window.scrollToCategory = function(e, categoryId) {
    if (e) e.preventDefault();
    const target = document.getElementById(categoryId);
    if (target) {
        const offset = 75; // category-nav height + margin
        const bodyRect = document.body.getBoundingClientRect().top;
        const targetRect = target.getBoundingClientRect().top;
        const targetPosition = targetRect - bodyRect;
        const offsetPosition = targetPosition - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
        
        // 更新 active 狀態
        const navLinks = document.querySelectorAll(".category-nav .nav-link");
        navLinks.forEach(link => {
            if (link.getAttribute("href") === `#${categoryId}`) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }
}

// 滾動監聽 (Scrollspy) 自動高亮導覽列
window.addEventListener("scroll", () => {
    const categories = ["cat-main", "cat-bone", "cat-addon", "cat-vegetable"];
    const scrollPos = window.scrollY + 120; // 偏移閾值
    
    let currentCategory = "";
    
    for (let i = 0; i < categories.length; i++) {
        const element = document.getElementById(categories[i]);
        if (element) {
            const offsetTop = element.offsetTop;
            if (scrollPos >= offsetTop) {
                currentCategory = categories[i];
            }
        }
    }
    
    if (currentCategory) {
        const navLinks = document.querySelectorAll(".category-nav .nav-link");
        navLinks.forEach(link => {
            const href = link.getAttribute("href");
            if (href === `#${currentCategory}`) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }
});

// 清除訂單重新開始
function clearOrder() {
    if (confirm("確定要清除整筆訂單重新開始嗎？\n這將清空您目前所有分包中的點餐品項、姓名與電話。")) {
        // 重置袋子
        initBags();
        
        // 清空輸入欄位
        document.getElementById("customer-name").value = "";
        document.getElementById("customer-phone").value = "";
        document.getElementById("pickup-time").value = "";
        
        // 重新渲染
        renderTabs();
        renderActiveBag();
        initTimeOptions();
        updateGrandTotal();
        
        alert("訂單已清除，請重新開始挑選！");
    }
}

// 動態更新錨點導覽列上的選中品項數量
function updateCategoryNavCounts() {
    const currentBag = bags[activeBagIndex];
    if (!currentBag) return;

    // 定義四大類別
    const categories = {
        main: { el: document.querySelector('#category-nav a[href="#cat-main"]'), name: "吃主食", icon: "fa-drumstick-bite" },
        bone: { el: document.querySelector('#category-nav a[href="#cat-bone"]'), name: "啃骨頭", icon: "fa-bone" },
        addon: { el: document.querySelector('#category-nav a[href="#cat-addon"]'), name: "加配料", icon: "fa-pizza-slice" },
        vegetable: { el: document.querySelector('#category-nav a[href="#cat-vegetable"]'), name: "選鮮蔬", icon: "fa-seedling" }
    };

    // 計算當前包包中，各類別選中的 unique 品項數 (distinct item count)
    const counts = { main: 0, bone: 0, addon: 0, vegetable: 0 };

    for (let itemId in currentBag.items) {
        const qty = currentBag.items[itemId];
        if (qty > 0) {
            const item = menu.find(m => m.id === itemId);
            if (item && counts[item.type] !== undefined) {
                counts[item.type] += qty;
            }
        }
    }

    // 更新 DOM
    for (let type in categories) {
        const cat = categories[type];
        if (cat.el) {
            const countSuffix = counts[type] > 0 ? ` (${counts[type]})` : "";
            cat.el.innerHTML = `<i class="fa-solid ${cat.icon}"></i> ${cat.name}${countSuffix}`;
        }
    }
}

// 判斷當前是否處於開放點餐時間 (15:00 - 20:30)
function isOrderTime() {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = 15 * 60; // 15:00 = 900
    const endMins = 20 * 60 + 30; // 20:30 = 1230
    return currentMins >= startMins && currentMins <= endMins;
}

// 檢查開放點餐時間並更新按鈕 UI
function checkOrderTimeUI() {
    const submitBtn = document.getElementById("submit-order-btn");
    if (!submitBtn) return;
    
    if (!isOrderTime()) {
        submitBtn.disabled = true;
        submitBtn.classList.add("disabled");
        submitBtn.querySelector(".btn-text").innerText = "非開放點餐時間 (15:00-20:30)";
        const icon = submitBtn.querySelector(".btn-icon");
        if (icon) icon.style.display = "none";
    } else {
        submitBtn.disabled = false;
        submitBtn.classList.remove("disabled");
        submitBtn.querySelector(".btn-text").innerText = "確認送出訂單";
        const icon = submitBtn.querySelector(".btn-icon");
        if (icon) icon.style.display = "inline-flex";
    }
}

// 渲染系統營運狀態與 Banner 提示
function renderSystemStatusUI() {
    const banner = document.getElementById("system-status-banner");
    const textSpan = document.getElementById("system-status-text");
    const submitBtn = document.getElementById("submit-order-btn");
    
    if (!banner || !submitBtn) return;
    
    if (systemStatus.isRestDay) {
        // 今日公休
        banner.style.display = "flex";
        banner.style.background = "#dc2626"; // 招牌鮮紅
        if (textSpan) textSpan.innerHTML = `<strong>【今日公休】</strong>本店今日公休，暫停線上點餐與取餐服務，敬請見諒。`;
        
        submitBtn.disabled = true;
        submitBtn.classList.add("disabled");
        submitBtn.querySelector(".btn-text").innerText = "今日公休 (暫停點餐)";
        const icon = submitBtn.querySelector(".btn-icon");
        if (icon) icon.style.display = "none";
    } else if (systemStatus.isPaused) {
        // 暫停線上點餐
        banner.style.display = "flex";
        banner.style.background = "#e76400"; // 亮橘色
        if (textSpan) textSpan.innerHTML = `<strong>【暫停線上點餐】</strong>目前店家現場繁忙，暫停線上點餐，可稍後重新整理網頁查看，謝謝。`;
        
        submitBtn.disabled = true;
        submitBtn.classList.add("disabled");
        submitBtn.querySelector(".btn-text").innerText = "暫停線上點餐中";
        const icon = submitBtn.querySelector(".btn-icon");
        if (icon) icon.style.display = "none";
    } else {
        // 正常狀態
        banner.style.display = "none";
        // 交由營業時間邏輯處理提交按鈕
        checkOrderTimeUI();
    }
}
