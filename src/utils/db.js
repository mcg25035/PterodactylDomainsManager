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
            otherData TEXT,
            customDomain TEXT
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
            connectedAt TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            customDomain TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS playerFirewall (
            id TEXT PRIMARY KEY,
            serverId TEXT NOT NULL,
            type TEXT NOT NULL,
            value TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            expiresAt INTEGER
        )
    `);

    db.run("ALTER TABLE domains ADD COLUMN customDomain TEXT", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Error adding customDomain column to domains table:", err.message);
        }
    });

    db.run("ALTER TABLE connectionLogs ADD COLUMN customDomain TEXT", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Error adding customDomain column to connectionLogs table:", err.message);
        }
    });

    db.run("ALTER TABLE playerFirewall ADD COLUMN customDomain TEXT", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Error adding customDomain column to playerFirewall table:", err.message);
        }
    });
});

module.exports = db;
