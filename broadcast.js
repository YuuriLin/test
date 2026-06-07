require('dotenv').config();
const mysql = require('mysql2/promise');
const line = require('@line/bot-sdk');

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
};
const client = new line.messagingApi.MessagingApiClient(config);

const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// === [訊息設定區] 請在此調整目標、模式與內容 ===
const TARGET_TAG = "已購買"; // 群發對象：填 "已購買" 或 "未購買"
const MODE = "TEXT_ONLY";     // 選擇模式：填 "TEXT_ONLY", "IMAGE_MIXED", "VIDEO_MIXED"

const broadcastContent = {
    TEXT_ONLY: [
        { type: "text", text: "【四花軟居 VIP 老友獨享】🐾\n\n感謝您的購買，老客戶回購優惠碼：【4HUA50】，下單現折 50 元！" }
    ],
    IMAGE_MIXED: [
        { type: "image", originalContentUrl: "https://網址.jpg", previewImageUrl: "https://網址.jpg" },
        { type: "text", text: "【新品上市】圖片中的床包現在有優惠喔！" }
    ],
    VIDEO_MIXED: [
        { type: "video", originalContentUrl: "https://網址.mp4", previewImageUrl: "https://網址.jpg" },
        { type: "text", text: "【療癒短片】看看這款床包多舒服！" }
    ]
};

const messagesToSend = broadcastContent[MODE];
// ===========================================

async function startBroadcast() {
    try {
        const sql = `SELECT DISTINCT user_id FROM click_logs WHERE tag_group = ? AND user_id LIKE 'U%'`;
        const [rows] = await dbPool.query(sql, [TARGET_TAG]);
        
        if (rows.length === 0) return console.log(`找不到目標使用者。`);

        const userIds = rows.map(row => row.user_id);
        await client.multicast({ to: userIds, messages: messagesToSend });

        console.log(`✅ 【${TARGET_TAG}】群發成功，共送達 ${userIds.length} 位客戶！`);
    } catch (error) {
        console.error('❌ 群發錯誤:', error.message);
    } finally {
        await dbPool.end();
    }
}

startBroadcast();