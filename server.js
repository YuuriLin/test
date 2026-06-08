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
    ssl: { rejectUnauthorized: false } // Aiven 資料庫必備
});

// 四花軟居「歡迎詞」Flex 訊息主體
const getWelcomeFlexMessage = (displayName) => {
  return {
    type: "flex",
    altText: `${displayName} 您好，歡迎來到四花軟居！😆`, 
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        backgroundColor: "#FFFFFF",
        contents: [
          {
            type: "text",
            text: `${displayName} 您好，很開心您與四花成為好友😆\n\n我們秉持著「打造和貓咪一樣的療癒睡眠想像💤」的出發點，讓四花軟居不只是一個寢具品牌，而是陪你打造一個更舒服、更放鬆的睡眠情境。\n\n先簡單選擇以下選項，了解看看我們有甚麼睡眠好物吧!`,
            wrap: true,
            size: "sm",
            color: "#333333",
            lineSpacing: "5px"
          },
          // 分隔線
          { type: "separator", margin: "lg", color: "#CCCCCC" },
          
          // 下方選項（優雅細體、灰藍色、置中無邊框）
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "xl",
            contents: [
              {
                type: "text",
                text: "先逛逛人氣商品",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { type: "message", label: "先逛逛人氣商品", text: "先逛逛人氣商品" }
              },
              {
                type: "text",
                text: "找適合我的枕頭",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { type: "message", label: "找適合我的枕頭", text: "找適合我的枕頭" }
              },
              {
                type: "text",
                text: "夏日涼感床包",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { type: "message", label: "夏日涼感床包", text: "夏日涼感床包" }
              },
              {
                type: "text",
                text: "助眠周邊小物",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { type: "message", label: "助眠周邊小物", text: "助眠周邊小物" }
              },
              {
                type: "text",
                text: "已購買客服詢問",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { type: "message", label: "5.已購買客服詢問", text: "5.已購買客服詢問" }
              },
              {
                type: "text",
                text: "寵物展限定 : 優惠卷領取",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { type: "message", label: "寵物展限定 : 優惠卷領取", text: "寵物展限定 : 優惠卷領取" }
              }
            ]
          }
        ]
      }
    }
  };
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

// 事件核心處理器
async function handleEvent(event) {
    // 狀況 1：當新好友加入（Follow）
    if (event.type === 'follow') {
        const userId = event.source.userId;
        let displayName = "新朋友";

        try {
            const profile = await client.getProfile(userId);
            displayName = profile.displayName;
        } catch (profileError) {
            console.error('無法取得使用者名稱:', profileError.message);
        }

        console.log(`[新好友加入] 名字: ${displayName} (ID: ${userId})`);
        
        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [getWelcomeFlexMessage(displayName)]
        });
    }

    // 狀況 2：當使用者點擊按鈕傳送純文字訊息過來（Message）
    if (event.type === 'message' && event.message.type === 'text') {
        const userText = event.message.text.trim();
        const userId = event.source.userId;
        console.log(`[收到文字訊息] 來自 ID: ${userId}, 內容: ${userText}`);

        // 🎯 核心修正：當點擊「寵物展限定 : 優惠卷領取」
        if (userText === '寵物展限定 : 優惠卷領取') {
            return client.replyMessage({
                replyToken: event.replyToken,
                messages: [
                    // 訊息 1：感謝語與折扣碼
                    {
                        type: 'text',
                        text: '感謝您的輸入，優惠代碼為:123，請於結帳時輸入即可套用，請點選以下您感興趣的商品，可以讓我們對您更加了解呦'
                    },
                    // 訊息 2：🔧 修正處：移除 bubble 層級中錯誤的 size: 'medium' 屬性
                    {
                        type: 'flex',
                        altText: '選擇您感興趣的商品系列',
                        contents: {
                            type: 'bubble',
                            body: {
                                type: 'box',
                                layout: 'vertical',
                                spacing: 'md',
                                contents: [
                                    {
                                        type: 'button',
                                        style: 'primary',
                                        color: '#4A6B82',
                                        height: 'sm',
                                        action: { type: 'message', label: '枕頭系列', text: '我想了解枕頭系列' }
                                    },
                                    {
                                        type: 'button',
                                        style: 'primary',
                                        color: '#4A6B82',
                                        height: 'sm',
                                        action: { type: 'message', label: '床包系列', text: '我想了解床包系列' }
                                    },
                                    {
                                        type: 'button',
                                        style: 'primary',
                                        color: '#4A6B82',
                                        height: 'sm',
                                        action: { type: 'message', label: '助眠香氛系列', text: '我想了解助眠香氛系列' }
                                    }
                                ]
                            }
                        }
                    },
                    // 訊息 3：優惠券的使用說明
                    {
                        type: 'text',
                        text: '優惠卷的使用說明:優惠代碼使用期限至7/18為止，不可與官網其餘優惠活動並用，但可與商品優惠組合併用，一組帳號僅限使用一次，每筆使用優惠代碼結帳訂單，皆會捐出$200分潤給「臺北市流浪貓保護協會」。'
                    }
                ]
            });
        }

        // 🏷️ 預留區塊：當顧客點擊商品系列按鈕時的回覆與貼標籤邏輯
        if (userText === '我想了解枕頭系列') {
            console.log(`[興趣標籤] 使用者 ${userId} 對【枕頭系列】感興趣`);
        }
        if (userText === '我想了解床包系列') {
            console.log(`[興趣標籤] 使用者 ${userId} 對【床包系列】感興趣`);
        }
        if (userText === '我想了解助眠香氛系列') {
            console.log(`[興趣標籤] 使用者 ${userId} 對【助眠香氛系列】感興趣`);
        }

        return null;
    }

    // 狀況 3：當使用者點擊傳統 Postback 按鈕
    if (event.type === 'postback') {
        const userId = event.source.userId;
        const postbackData = event.postback.data; 
        
        let displayName = "未知使用者";
        try {
            const profile = await client.getProfile(userId);
            displayName = profile.displayName;
        } catch (profileError) {
            console.error('無法取得點擊者名稱:', profileError.message);
        }

        console.log(`[點擊追蹤] 名字: ${displayName}, Data: ${postbackData}`);

        try {
            const params = new URLSearchParams(postbackData);
            const tagGroup = params.get('tag');
            const optionNum = params.get('option');

            const sql = 'INSERT INTO click_logs (user_id, tag_group, option_num, clicked_at) VALUES (?, ?, ?, NOW())';
            await dbPool.query(sql, [displayName, tagGroup, optionNum]);
            
            console.log(`[資料庫記錄成功] ${displayName} 歸類為【${tagGroup}】受眾`);

        } catch (dbError) {
            console.error('資料庫寫入失敗：', dbError.message);
        }
        return null;
    }
    return null;
}

// ==========================================
// 🛠️ 自動檢查並建立資料表的防呆機制
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
        console.error('⚠️ 資料庫連線或初始化失敗，請檢查 Render 的 DB 變數設定（目前不影響機器人發送訊息）：', err.message);
    }
}

// 使用安全封裝呼叫，防止因資料庫連不上而導致整個 Node 程式崩潰
try {
    initDatabaseTable();
} catch (e) {
    console.error('資料庫啟動引導異常:', e.message);
}

// ==========================================
// 📥 從網頁直接看資料庫紀錄的祕密通道
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
        res.status(500).send('資料庫讀取失敗（請先確認環境變數 DB_HOST 是否正確）：' + err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.redirect('/view-logs');
});
app.listen(PORT, () => {
    console.log(`🚀 Webhook 伺服器已在連接埠 ${PORT} 順利運作中！`);
});
