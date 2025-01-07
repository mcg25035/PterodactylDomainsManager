// src/utils/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/domains.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS domains (
            id TEXT PRIMARY KEY,
            serverId TEXT NOT NULL,
            thirdLevelDomain TEXT NOT NULL,
            targetIp TEXT,
            targetPort INTEGER,
            cloudflareARecordId TEXT,
            cloudflareSrvRecordId TEXT,
            otherData TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS connectionLogs (
            id TEXT PRIMARY KEY,
            serverId TEXT NOT NULL,
            fullDomain TEXT NOT NULL,
            playerName TEXT NOT NULL,
            playerIp TEXT NOT NULL,
            playerUuid TEXT NOT NULL,
            connectedAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
    `);
});

module.exports = db;
