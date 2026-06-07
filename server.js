const express = require('express');
const line = require('@line/bot-sdk');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

// LINE Bot 配置設定
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

// 建立 LINE 官方 Messaging API 客戶端
const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

// 建立資料庫連線池（Pool）
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } // 這是關鍵！
});

// 四花軟居「歡迎詞」Flex 訊息主體
const welcomeFlexMessage = {
  type: "flex",
  altText: "歡迎來到四花軟居！🐾",
  contents: {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "xl",
      backgroundColor: "#FFFFFF",
      contents: [
        { type: "text", text: "四花軟居 🐾", weight: "bold", size: "xl", color: "#111111" },
        {
          type: "text",
          text: "您好，很開心您與四花成為好友 📋\n\n我們期盼打造和貓咪一樣療癒的睡眠想像，讓寢具不只是陪伴，更是生活裡最放鬆的溫暖情境。💤\n\n先簡單選擇以下選項，看看我們有什麼睡眠好物吧！",
          wrap: true, size: "sm", color: "#333333", margin: "md", lineSpacing: "4px"
        },
        { type: "separator", margin: "lg", color: "#CCCCCC" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "md",
          contents: [
            { type: "button", action: { type: "postback", label: "1. 先逛逛人氣商品", data: "tag=未購買&option=1", displayText: "1. 先逛逛人氣商品" }, style: "primary", height: "md", color: "#7B9DBA" },
            { type: "button", action: { type: "postback", label: "2. 找適合我的枕頭", data: "tag=未購買&option=2", displayText: "2. 找適合我的枕頭" }, style: "primary", height: "md", color: "#7B9DBA" },
            { type: "button", action: { type: "postback", label: "3. 夏日涼感床包", data: "tag=未購買&option=3", displayText: "3. 夏日涼感床包" }, style: "primary", height: "md", color: "#7B9DBA" },
            { type: "button", action: { type: "postback", label: "4. 助眠周邊小物", data: "tag=未購買&option=4", displayText: "4. 助眠周邊小物" }, style: "primary", height: "md", color: "#7B9DBA" },
            { type: "button", action: { type: "postback", label: "5. 已購買客服詢問", data: "tag=未購買&option=5", displayText: "5. 已購買客服詢問" }, style: "primary", height: "md", color: "#7B9DBA" },
            { type: "button", action: { type: "postback", label: "6. 寵物展限定 : 優惠卷領取", data: "tag=未購買&option=6", displayText: "6. 寵物展限定 : 優惠卷領取" }, style: "primary", height: "md", color: "#7B9DBA" }
          ]
        }
      ]
    }
  }
};

// LINE 規定必須使用的簽章驗證中間件
app.post('/webhook', line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error('Webhook 錯誤:', err);
            res.status(500).end();
        });
});

// 事件核心處理器（已升級：自動動態抓取 LINE 使用者真實名稱）
async function handleEvent(event) {
    // 狀況 1：當新好友加入（Follow）
    if (event.type === 'follow') {
        const userId = event.source.userId;
        let displayName = "未知使用者";

        try {
            // 向 LINE 伺服器請求該使用者的個人檔案
            const profile = await client.getProfile(userId);
            displayName = profile.displayName;
        } catch (profileError) {
            console.error('無法取得使用者名稱:', profileError.message);
        }

        console.log(`[新好友加入] 名字: ${displayName} (ID: ${userId})`);
        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [welcomeFlexMessage]
        });
    }

    // 狀況 2：當使用者點擊按鈕（Postback）
    if (event.type === 'postback') {
        const userId = event.source.userId;
        const postbackData = event.postback.data; // 得到 "tag=未購買&option=2"
        
        let displayName = "未知使用者";
        try {
            // 動態抓取點擊者的 LINE 暱稱
            const profile = await client.getProfile(userId);
            displayName = profile.displayName;
        } catch (profileError) {
            console.error('無法取得點擊者名稱:', profileError.message);
        }

        console.log(`[點擊追蹤] 名字: ${displayName}, Data: ${postbackData}`);

        try {
            // 解析資料並寫入資料庫
            const params = new URLSearchParams(postbackData);
            const tagGroup = params.get('tag');
            const optionNum = params.get('option');

            // 【重要】這裡我們把原本存進資料庫的 userId 欄位，直接替換存入真實姓名 displayName
            const sql = 'INSERT INTO click_logs (user_id, tag_group, option_num, clicked_at) VALUES (?, ?, ?, NOW())';
            await dbPool.query(sql, [displayName, tagGroup, optionNum]);
            
            console.log(`[資料庫記錄成功] ${displayName} 歸類為【${tagGroup}】受眾`);

        } catch (dbError) {
            console.error('資料庫寫入失敗（請確認 MySQL 已建立對應資料表）：', dbError.message);
        }
        return null;
    }
    return null;
}

// ==========================================
// 🛠️ 新增：自動檢查並建立資料表的防呆機制
// ==========================================
async function initDatabaseTable() {
    try {
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS click_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                tag_group VARCHAR(50) NOT NULL,
                option_num INT NOT NULL,
                clicked_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await dbPool.query(createTableSql);
        console.log('✅ 資料庫連線成功，且 sihua_db.click_logs 資料表已自動準備就緒！');
    } catch (err) {
        console.error('❌ 資料庫初始化失敗，請確認 sihua_db 資料庫是否已存在：', err.message);
    }
}
initDatabaseTable();
// ==========================================
// 📥 新增：從網頁直接看資料庫紀錄的祕密通道
// ==========================================
app.get('/view-logs', async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT * FROM click_logs ORDER BY clicked_at DESC');
        
        let html = `
            <html>
            <head>
                <title>四花軟居 - 後台點擊紀錄</title>
                <meta charset="utf-8">
                <style>
                    body { font-family: "Helvetica Neue", Arial, sans-serif; background-color: #f4f6f9; color: #333; margin: 40px; }
                    h2 { color: #2c3e50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
                    table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border-radius: 5px; overflow: hidden; }
                    th, td { padding: 12px 15px; text-align: left; }
                    th { background-color: #4CAF50; color: white; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f8f9fa; }
                    tr:hover { background-color: #f1f1f1; }
                    .tag { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
                    .tag-unbought { background-color: #ffeaa7; color: #d63031; }
                    .tag-bought { background-color: #55efc4; color: #00b894; }
                </style>
            </head>
            <body>
                <h2>📊 四花軟居 LINE 貼標籤點擊紀錄 (最新在最前)</h2>
                <table>
                    <tr>
                        <th>編號</th>
                        <th>LINE 使用者 ID</th>
                        <th>受眾標籤群組</th>
                        <th>點擊選項</th>
                        <th>點擊時間</th>
                    </tr>
        `;
        
        rows.forEach(row => {
            const tagClass = row.tag_group === '已購買' ? 'tag-bought' : 'tag-unbought';
            html += `
                <tr>
                    <td>${row.id}</td>
                    <td><code>${row.user_id}</code></td>
                    <td><span class="tag ${tagClass}">${row.tag_group}</span></td>
                    <td><strong>第 ${row.option_num} 項</strong></td>
                    <td>${new Date(row.clicked_at).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}</td>
                </tr>`;
        });
        
        html += `</table></body></html>`;
        res.send(html);
    } catch (err) {
        res.status(500).send('資料庫讀取失敗：' + err.message);
    }
});

const PORT = process.env.PORT || 3000;
// 新增這段：讓網址只要打 https://sihua-line-bot.onrender.com/ 
// 就自動跳轉到你那精美的紀錄頁面
app.get('/', (req, res) => {
    res.redirect('/view-logs');
});
app.listen(PORT, () => {
    console.log(`🚀 Webhook 伺服器已在連接埠 ${PORT} 順利運作中！`);
});





