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

/**
 * 取 Connection Logs，支援：
 * - 分頁 (page, pageSize，預設 pageSize <= 50)
 * - 搜尋條件：playerIp, playerName (like), 時間區間 connectedAt
 */
function getConnectionLogs({ 
    page = 1, 
    pageSize = 50,
    ip,        // 完整比對：playerIp = ?
    username,  // 模糊比對：playerName LIKE ?
    uuid,     // 完整比對：playerUuid = ?
    fromTime,  // connectedAt >= fromTime
    toTime,     // connectedAt <= toTime
    server  // serverId
} = {}) {
    return new Promise((resolve, reject) => {
        // 先組裝基本 SQL
        // 注意：若資料量大，可能需要再做索引 (INDEX)
        let baseQuery = `SELECT * FROM connectionLogs WHERE 1=1`;
        let countQuery = `SELECT COUNT(*) as count FROM connectionLogs WHERE 1=1`;

        const params = [];
        const countParams = [];

        // 若有指定 ip
        if (ip) {
            baseQuery += ` AND playerIp = ?`;
            countQuery += ` AND playerIp = ?`;
            params.push(ip);
            countParams.push(ip);
        }

        // 若有指定玩家名稱 (使用部分比對)
        if (username) {
            baseQuery += ` AND playerName LIKE ?`;
            countQuery += ` AND playerName LIKE ?`;
            params.push(`%${username}%`);
            countParams.push(`%${username}%`);
        }

        if (uuid) {
            baseQuery += ` AND playerUuid = ?`;
            countQuery += ` AND playerUuid = ?`;
            params.push(uuid);
            countParams.push(uuid);
        }

        // 若有時間區間 (fromTime ~ toTime)
        if (fromTime) {
            baseQuery += ` AND connectedAt >= ?`;
            countQuery += ` AND connectedAt >= ?`;
            params.push(fromTime);
            countParams.push(fromTime);
        }

        if (toTime) {
            baseQuery += ` AND connectedAt <= ?`;
            countQuery += ` AND connectedAt <= ?`;
            params.push(toTime);
            countParams.push(toTime);
        }

        if (server) {
            baseQuery += ` AND serverId = ?`;
            countQuery += ` AND serverId = ?`;
            params.push(server);
            countParams.push(server);
        }

        // 先做 countQuery 查總筆數
        db.get(countQuery, countParams, (err, row) => {
            if (err) {
                return reject(err);
            }

            // 總筆數
            const total = row ? row.count : 0;

            // 處理 pageSize 上限
            if (pageSize > 50) {
                pageSize = 50;
            }

            // 分頁計算 offset
            const offset = (page - 1) * pageSize;

            // 在 main query 加入排序、分頁
            baseQuery += ` ORDER BY connectedAt DESC LIMIT ? OFFSET ?`;
            // 把 limit 與 offset 參數推進去
            params.push(pageSize, offset);

            // 查詢結果資料
            db.all(baseQuery, params, (err2, rows) => {
                if (err2) {
                    return reject(err2);
                }

                // 回傳結構：包含 data、總筆數、目前頁數、每頁限制、總頁數
                resolve({
                    data: rows,
                    total,
                    page,
                    pageSize,
                    totalPages: Math.ceil(total / pageSize)
                });
            });
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
async function createConnectionLog({ fullDomain, playerName, playerIp, playerUuid }) {
    // 1. 查詢 domain，取得 serverId
    const serverId = await getServerIdByFullDomain(fullDomain);
    if (!serverId) {
        throw new Error(`No domain found for ${fullDomain}`);
    }

    return new Promise((resolve, reject) => {
        const id = uuidv4();
        db.run(`
            INSERT INTO connectionLogs (id, serverId, fullDomain, playerName, playerIp, playerUuid)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        [id, serverId, fullDomain, playerName, playerIp, playerUuid],
        function (err) {
            if (err) return reject(err);
            resolve({
                id,
                serverId,
                fullDomain,
                playerName,
                playerIp,
                playerUuid,
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
