# -*- coding: utf-8 -*-
"""
榮 鹽水雞點餐系統 - 每日定時自動重置腳本
1. 重置 Firebase 總表中所有品項狀態為「開啟 (true)」
2. 將「去骨雞腿」的線上配額重新補滿為 5 隻
3. 刪除大於兩天前的舊訂單 (48小時以上)
4. 【新增】若系統仍處於公休/暫停狀態，發送 Discord 早安防忘提醒 Embed 卡片
"""

import os
import json
import datetime
import urllib.request
import urllib.error
from datetime import timezone, timedelta

# ── Discord Webhook 設定 ──────────────────────────────────────────────
# 從 GitHub Secrets 讀取 Discord Webhook URL（直接傳給 Discord，不經 Apps Script）
# 請在 GitHub Repo Settings > Secrets > DISCORD_WEBHOOK_URL 中設定真實的 Discord Webhook URL
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# 後台管理頁面網址（點擊 Discord 通知可直接跳轉）
ADMIN_PAGE_URL = os.environ.get("ADMIN_PAGE_URL", "https://你的帳號.github.io/你的repo名稱/admin.html")
# ─────────────────────────────────────────────────────────────────────


def send_discord_embed(title: str, description: str, color: int, footer: str = "榮 鹽水雞 自動提醒系統") -> bool:
    """
    直接呼叫 Discord Webhook API 發送 Embed 卡片（不需透過 Apps Script）。
    回傳 True 表示成功，False 表示失敗。
    """
    if not DISCORD_WEBHOOK_URL:
        print("[WARNING] 未設定 DISCORD_WEBHOOK_URL 環境變數，跳過 Discord 通知。")
        print("[TIP] 請到 GitHub Repo > Settings > Secrets and Variables > Actions，")
        print("       新增 Secret 名稱: DISCORD_WEBHOOK_URL，值為你的 Discord Webhook 網址。")
        return False

    payload = {
        "embeds": [{
            "title": title,
            "description": description,
            "color": color,
            "footer": {"text": footer},
            "timestamp": datetime.datetime.now(timezone.utc).isoformat()
        }]
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            DISCORD_WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            # Discord 成功時回傳 204 No Content
            if resp.status in (200, 204):
                return True
            else:
                print(f"[WARNING] Discord 回傳非預期狀態碼: {resp.status}")
                return False
    except urllib.error.HTTPError as e:
        print(f"[ERROR] Discord Webhook HTTP 錯誤: {e.code} {e.reason}")
        return False
    except Exception as e:
        print(f"[ERROR] Discord Webhook 發送失敗: {e}")
        return False


def main():
    print("[INFO] 榮 鹽水雞每日自動重置工作開始執行...")

    # 試圖讀取 GitHub Secrets 中設定的 Firebase 金鑰
    service_account_env = os.environ.get("FIREBASE_SERVICE_ACCOUNT")

    if not service_account_env:
        print("[WARNING] 未在環境變數中找到 FIREBASE_SERVICE_ACCOUNT。")
        print("[WARNING] 此腳本僅能在配置 Firebase 憑證的環境下執行資料重置。")
        print("[INFO] 若為本機開發模擬，請手動清除瀏覽器的 LocalStorage 即可重置。")
        return

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("[ERROR] 缺少 firebase-admin 模組，請使用 'pip install firebase-admin' 安裝。")
        return

    try:
        # 解析憑證並初始化 Firebase App
        cred_dict = json.loads(service_account_env)
        cred = credentials.Certificate(cred_dict)

        # 避免重複初始化
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        db = firestore.client()
        print("[INFO] Firebase Admin 連線成功！")

        # ── 步驟 1：自動重置菜單 ────────────────────────────────────────
        print("[INFO] 1/4 開始重置菜單品項狀態...")
        menu_ref = db.collection('menu')
        menu_docs = menu_ref.stream()

        reset_count = 0
        for doc in menu_docs:
            doc.reference.update({'status': True})
            reset_count += 1

        print(f"[SUCCESS] 菜單重置完成，共重置 {reset_count} 個品項。")

        # ── 步驟 2：補滿雞腿配額 ────────────────────────────────────────
        print("[INFO] 2/4 開始補滿「去骨雞腿」配額...")
        quota_ref = db.collection('settings').document('drumstick_quota')
        quota_ref.set({'quota': 5})
        print("[SUCCESS] 招牌去骨雞腿配額已補滿為 5 隻。")

        # ── 步驟 3：清理舊訂單 ──────────────────────────────────────────
        print("[INFO] 3/4 開始清理舊訂單數據...")
        cutoff_time = datetime.datetime.now(timezone.utc) - timedelta(days=2)

        orders_ref = db.collection('orders')
        old_orders = orders_ref.stream()

        deleted_count = 0
        for order in old_orders:
            data = order.to_dict()
            created_at_str = data.get("createdAt")
            if created_at_str:
                try:
                    time_clean = created_at_str.replace("Z", "+00:00")
                    order_time = datetime.datetime.fromisoformat(time_clean)
                    if order_time < cutoff_time:
                        order.reference.delete()
                        deleted_count += 1
                except Exception as ex:
                    print(f"[WARNING] 無法解析訂單 {order.id} 的時間: {created_at_str}, 錯誤: {ex}")

        print(f"[SUCCESS] 舊訂單清理完成，共刪除 {deleted_count} 筆舊紀錄。")

        # ── 步驟 4：【新功能】檢查系統狀態並發送早安防忘提醒 ─────────────
        print("[INFO] 4/4 檢查系統是否處於公休/暫停狀態...")

        status_ref = db.collection('settings').document('system_status')
        status_doc = status_ref.get()
        is_rest_day = False
        is_paused = False

        if status_doc.exists:
            status_data = status_doc.to_dict()
            is_rest_day = status_data.get("isRestDay", False)
            is_paused = status_data.get("isPaused", False)

        if is_rest_day or is_paused:
            # 判斷狀態類型，組合通知訊息
            status_parts = []
            if is_rest_day:
                status_parts.append("📴 **今日公休**")
            if is_paused:
                status_parts.append("⏸️ **暫停線上點餐**")

            status_text = " + ".join(status_parts)

            # 組裝早安提醒 Embed 卡片內容
            description_lines = [
                "🌞 **早安！系統偵測到以下狀態仍在開啟中：**",
                "",
                f"  {status_text}",
                "",
                "─────────────────────────",
                "",
                "🎯 **如果今天有要正常開攤營業，請記得進後台關閉上列狀態，",
                "以免顧客無法線上點餐喔！**",
                "",
                f"> 👉 **[🔗 一鍵連回後台開啟點餐功能]({ADMIN_PAGE_URL})**",
            ]
            description = "\n".join(description_lines)

            print(f"[INFO] 系統處於 {status_text} 狀態，準備發送早安防忘提醒...")

            success = send_discord_embed(
                title="🔔  清晨防忘提醒：系統尚未開放線上點餐",
                description=description,
                color=0xED8936,  # 橘色警示
                footer="榮 鹽水雞 清晨自動提醒 ─ 如已確認今日公休可忽略此通知"
            )

            if success:
                print("[SUCCESS] 早安防忘提醒 Discord 通知發送成功！")
            else:
                print("[WARNING] 早安防忘提醒發送失敗，請確認 DISCORD_WEBHOOK_URL Secret 是否設定正確。")
        else:
            print("[INFO] 系統狀態正常（未公休、未暫停），無須發送提醒。")

        print("[INFO] 榮 鹽水雞每日自動重置工作順利完成！")

    except Exception as e:
        print(f"[ERROR] 執行重置時發生未預期錯誤: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
