const express = require('express');
const line = require('@line/bot-sdk');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

// ==========================================
// 1. LINE Bot 與 資料庫 配置設定
// ==========================================
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
    ssl: { rejectUnauthorized: false } // Aiven Cloud 安全連線設定
});

// ==========================================
// 2. LINE Flex 訊息樣板（歡迎詞）
// ==========================================
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
          
          // 下方選項
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

// ==========================================
// 3. 🎯 優惠券 Flex 訊息樣板（精準分類標籤版）
// ==========================================
const getCouponFlexMessage = () => {
  return {
    type: "flex",
    altText: "感謝您的輸入，這是您的寵物展限定優惠！", 
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        backgroundColor: "#FFFFFF",
        contents: [
          // 上方：感謝語與引導文字
          {
            type: "text",
            text: "感謝您的輸入，優惠代碼為:123，請於結帳時輸入即可套用，\n請點選以下您感興趣的商品，可以讓我們對您更加了解呦。",
            wrap: true,
            size: "sm",
            color: "#333333",
            lineSpacing: "5px"
          },
          // 中間：使用說明提示
          {
            type: "text",
            text: "⚠️ 使用說明:優惠代碼使用期限至7/18為止，不可與官網其餘優惠活動並用，但可與商品優惠組合併用，一組帳號僅限使用一次，每筆使用優惠代碼結帳訂單，皆會捐出$200分潤給「臺北市流浪貓保護協會」。",
            wrap: true,
            size: "xs",
            color: "#666666",
            margin: "md",
            lineSpacing: "4px"
          },
          // 分隔線
          { type: "separator", margin: "lg", color: "#CCCCCC" },
          
          // 下方選項：🔧 標籤改為依點選品類精準獨立命名
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "xl",
            contents: [
              {
                type: "text",
                text: "枕頭系列",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { 
                    type: "postback", 
                    label: "枕頭系列", 
                    data: "tag=枕頭系列&option=1", // 👈 標籤直接寫入「枕頭系列」
                    displayText: "我想了解枕頭系列" 
                }
              },
              {
                type: "text",
                text: "床包系列",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { 
                    type: "postback", 
                    label: "床包系列", 
                    data: "tag=床包系列&option=2", // 👈 標籤直接寫入「床包系列」
                    displayText: "我想了解床包系列" 
                }
              },
              {
                type: "text",
                text: "助眠香氣系列",
                size: "md",
                color: "#4A6B82",
                align: "center",
                action: { 
                    type: "postback", 
                    label: "助眠香氣系列", 
                    data: "tag=助眠香氣系列&option=3", // 👈 標籤直接寫入「助眠香氣系列」
                    displayText: "我想了解助眠香氣系列" 
                }
              }
            ]
          }
        ]
      }
    }
  };
};

// ==========================================
// 4. LINE Webhook 路由與核心事件處理器
// ==========================================
app.post('/webhook', line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error('Webhook 核心錯誤:', err);
            res.status(500).end();
        });
});

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

    // 狀況 2：當使用者傳送純文字訊息
    if (event.type === 'message' && event.message.type === 'text') {
        const userText = event.message.text.trim();
        const userId = event.source.userId;
        console.log(`[收到文字訊息] 來自 ID: ${userId}, 內容: ${userText}`);

        // 當點擊「寵物展限定 : 優惠卷領取」
        if (userText === '寵物展限定 : 優惠卷領取') {
            return client.replyMessage({
                replyToken: event.replyToken,
                messages: [getCouponFlexMessage()]
            });
        }
        return null;
    }

    // 狀況 3：當使用者點擊貼標籤型選項（Postback）
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

            // 寫入資料庫
            const sql = 'INSERT INTO click_logs (user_id, tag_group, option_num, clicked_at) VALUES (?, ?, ?, NOW())';
            await dbPool.query(sql, [displayName, tagGroup, optionNum]);
            
            console.log(`[資料庫記錄成功] ${displayName} 歸類為【${tagGroup}】`);

        } catch (dbError) {
            console.error('資料庫寫入失敗：', dbError.message);
        }

        // 自動回饋感謝訊息
        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
                type: 'text',
                text: '感謝您的選擇！小幫手已為您登記您的商品喜好囉 🥰💤'
            }]
        });
    }
    return null;
}

// ==========================================
// 5. 自動檢查並建立資料表的防呆機制
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
        console.warn('⚠️ 資料庫初始化提示（不影響LINE聊天）：', err.message);
    }
}

try {
    initDatabaseTable();
} catch (e) {
    console.error('資料庫引導異常:', e.message);
}

// ==========================================
// 6. 後台點擊紀錄網頁明細
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
                    .tag-product { background-color: #e8f4fd; color: #1da1f2; border: 1px solid #bee3f8; }
                    .tag-bought { background-color: #55efc4; color: #00b894; }
                    .tag-other { background-color: #ffeaa7; color: #b33939; }
                </style>
            </head>
            <body>
                <h2>📊 四花軟居 LINE 貼標籤點擊紀錄 (最新在最前)</h2>
                <table>
                    <tr>
                        <th>編號</th>
                        <th>LINE 使用者名稱/ID</th>
                        <th>受眾標籤群組</th>
                        <th>點擊選項</th>
                        <th>點擊時間</th>
                    </tr>
        `;
        
        rows.forEach(row => {
            let tagClass = 'tag-product';
            if (row.tag_group === '已購買') {
                tagClass = 'tag-bought';
            } else if (!row.tag_group.includes('系列')) {
                tagClass = 'tag-other';
            }
            
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
        res.status(500).send('後台資料讀取失敗：' + err.message);
    }
});

// ==========================================
// 7. 啟動 Web 伺服器
// ==========================================
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.redirect('/view-logs');
});
app.listen(PORT, () => {
    console.log(`🚀 Webhook 伺服器已在連接埠 ${PORT} 順利運作中！`);
});
