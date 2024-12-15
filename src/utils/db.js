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
});

module.exports = db;
