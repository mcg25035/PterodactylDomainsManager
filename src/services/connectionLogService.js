// src/services/connectionLogService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

/**
 * 給 fullDomain，例如 "mc.example.com"
 * 去資料庫 domains 表格找出對應的 thirdLevelDomain、serverId 等資料
 */
function findDomainByFullDomain(fullDomain) {
    return new Promise((resolve, reject) => {
        // fullDomain => thirdLevelDomain + '.' + SECOND_LEVEL_DOMAIN
        // 我們假設在 .env 裡有 SECOND_LEVEL_DOMAIN，或者直接在程式推算
        // 這裡簡化做法：利用字串切割或直接查全部 domain 再比對
        db.get('SELECT * FROM domains', [], (err, row) => {
            // 這裡是示範，實務上應該要 SELECT * FROM domains WHERE thirdLevelDomain = ?
            // 不過你可能要先拆 `fullDomain` => `thirdLevelDomain`
            // 例如: fullDomain = "abc.example.com"
            // thirdLevelDomain = "abc"
            // if (err) ...
        });
    });
}

function getConnectionLogs() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM connectionLogs', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function getConnectionLogById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM connectionLogs WHERE id = ?', [id], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(null);
            resolve(row);
        });
    });
}

function getConnectionLogByServerId(serverId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM connectionLogs WHERE serverId = ?', [serverId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * 建立一筆連線紀錄：依 fullDomain -> 找出對應 serverId，再寫入 connectionLogs
 */
async function createConnectionLog({ fullDomain, playerName, playerIp }) {
    // 1. 查詢 domain，取得 serverId
    const serverId = await getServerIdByFullDomain(fullDomain);
    if (!serverId) {
        throw new Error(`No domain found for ${fullDomain}`);
    }

    return new Promise((resolve, reject) => {
        const id = uuidv4();
        db.run(`
            INSERT INTO connectionLogs (id, serverId, fullDomain, playerName, playerIp)
            VALUES (?, ?, ?, ?, ?)
        `,
        [id, serverId, fullDomain, playerName, playerIp],
        function (err) {
            if (err) return reject(err);
            resolve({
                id,
                serverId,
                fullDomain,
                playerName,
                playerIp,
                connectedAt: null, // DB 預設值
            });
        });
    });
}

/**
 * 刪除指定 ID 的連線紀錄
 */
function deleteConnectionLog(id) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM connectionLogs WHERE id = ?', [id], function (err) {
            if (err) return reject(err);
            // 若有刪除，changes 會 > 0
            resolve(this.changes > 0);
        });
    });
}

/* 
 * =========================================================
 * 以下為關鍵方法：根據 fullDomain 取得對應的 serverId 
 * =========================================================
 */
const { SECOND_LEVEL_DOMAIN } = process.env;

/** 
 * 例如 fullDomain = "mc.example.com"
 * 分割出 thirdLevelDomain = "mc" (假設 SECOND_LEVEL_DOMAIN = "example.com")
 * 然後查 DB: SELECT serverId FROM domains WHERE thirdLevelDomain = 'mc'
 */
function getServerIdByFullDomain(fullDomain) {
    return new Promise((resolve, reject) => {
        if (!SECOND_LEVEL_DOMAIN) {
            return reject(new Error('SECOND_LEVEL_DOMAIN is not set in .env'));
        }

        // 先從 fullDomain 結尾把 .SECOND_LEVEL_DOMAIN 拿掉
        const suffix = `.${SECOND_LEVEL_DOMAIN}`; // => ".example.com"
        if (!fullDomain.endsWith(suffix)) {
            // fullDomain 不符合
            return resolve(null);
        }

        // thirdLevelDomain => "mc"
        const thirdLevelDomain = fullDomain.slice(0, -suffix.length);

        db.get(
            'SELECT serverId FROM domains WHERE thirdLevelDomain = ?',
            [thirdLevelDomain],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve(row.serverId);
            }
        );
    });
}

module.exports = {
    getConnectionLogs,
    getConnectionLogById,
    createConnectionLog,
    deleteConnectionLog,
    getConnectionLogByServerId
};
