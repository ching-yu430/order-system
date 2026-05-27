# -*- coding: utf-8 -*-
"""
榮 鹽水雞點餐系統 - 每日定時自動重置腳本
1. 重置 Firebase 總表中所有品項狀態為「開啟 (true)」
2. 將「去骨雞腿」的線上配額重新補滿為 5 隻
3. 刪除大於兩天前的舊訂單 (48小時以上)
"""

import os
import json
import datetime
from datetime import timezone, timedelta

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
        
        # 1. 自動重置菜單：將所有品項 status 設為 True
        print("[INFO] 1/3 開始重置菜單品項狀態...")
        menu_ref = db.collection('menu')
        menu_docs = menu_ref.stream()
        
        reset_count = 0
        for doc in menu_docs:
            doc.reference.update({'status': True})
            reset_count += 1
            
        print(f"[SUCCESS] 菜單重置完成，共重置 {reset_count} 個品項。")
        
        # 2. 補滿雞腿配額：設定為 5 隻
        print("[INFO] 2/3 開始補滿「去骨雞腿」配額...")
        quota_ref = db.collection('settings').document('drumstick_quota')
        quota_ref.set({'quota': 5})
        print("[SUCCESS] 招牌去骨雞腿配額已補滿為 5 隻。")
        
        # 3. 定期清理資料：刪除兩天前 (48小時前) 的舊訂單
        print("[INFO] 3/3 開始清理舊訂單數據...")
        cutoff_time = datetime.datetime.now(timezone.utc) - timedelta(days=2)
        
        orders_ref = db.collection('orders')
        # 查詢早於 cutoff_time 的訂單
        # 注意: 即使沒有建立 timestamp 索引，利用 ISO 字串做比較或是 query 也可以
        old_orders = orders_ref.stream()
        
        deleted_count = 0
        for order in old_orders:
            data = order.to_dict()
            created_at_str = data.get("createdAt")
            if created_at_str:
                try:
                    # 解析 ISO 8601 時間字串
                    # 格式: 2026-05-27T13:26:21.000Z
                    # 統一替換 'Z' 並切片以便處理
                    time_clean = created_at_str.replace("Z", "+00:00")
                    order_time = datetime.datetime.fromisoformat(time_clean)
                    
                    if order_time < cutoff_time:
                        order.reference.delete()
                        deleted_count += 1
                except Exception as ex:
                    print(f"[WARNING] 無法解析訂單 {order.id} 的時間: {created_at_str}, 錯誤: {ex}")
        
        print(f"[SUCCESS] 舊訂單清理完成，共刪除 {deleted_count} 筆舊紀錄。")
        print("[INFO] 榮 鹽水雞每日自動重置工作順利完成！")

    except Exception as e:
        print(f"[ERROR] 執行重置時發生未預期錯誤: {e}")

if __name__ == "__main__":
    main()
