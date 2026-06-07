const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDatabase() {
    try {
        // 先不安裝特定資料庫，純粹連上 MySQL 總機
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });

        // 叫總機幫我們蓋一個叫 sihua_db 的資料庫
        await connection.query('CREATE DATABASE IF NOT EXISTS sihua_db;');
        console.log('🎉 恭喜！sihua_db 資料庫已在 MySQL 中成功建立！');
        
        await connection.end();
    } catch (err) {
        console.error('❌ 建立失敗，請確認你的 MySQL 有啟動，且密碼是 1234：', err.message);
    }
}

createDatabase();