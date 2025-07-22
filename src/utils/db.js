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
        CREATE TABLE IF NOT EXISTS fixed_endpoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT NOT NULL,
            port INTEGER NOT NULL,
            createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
    `);

    // Migration logic for FIXED_IP and FIXED_PORT from .env
    db.get("SELECT COUNT(*) AS count FROM fixed_endpoints", (err, row) => {
        if (err) {
            console.error("Error checking fixed_endpoints table:", err.message);
            return;
        }
        if (row.count === 0) {
            console.log("Migrating FIXED_IP and FIXED_PORT from .env to database...");
            const fixedIps = process.env.FIXED_IP ? process.env.FIXED_IP.split(',').map(s => s.trim()) : [];
            const fixedPorts = process.env.FIXED_PORT ? process.env.FIXED_PORT.split(',').map(s => parseInt(s.trim())) : [];

            const endpointsToInsert = [];
            for (let i = 0; i < Math.min(fixedIps.length, fixedPorts.length); i++) {
                if (fixedIps[i] && !isNaN(fixedPorts[i])) {
                    endpointsToInsert.push({ ip: fixedIps[i], port: fixedPorts[i] });
                }
            }

            if (endpointsToInsert.length > 0) {
                db.serialize(() => {
                    const stmt = db.prepare("INSERT INTO fixed_endpoints (ip, port) VALUES (?, ?)");
                    endpointsToInsert.forEach(endpoint => {
                        stmt.run(endpoint.ip, endpoint.port);
                    });
                    stmt.finalize();
                    console.log(`Migrated ${endpointsToInsert.length} fixed endpoints.`);
                });
            } else {
                console.log("No FIXED_IP or FIXED_PORT found in .env for migration.");
            }
        } else {
            console.log("fixed_endpoints table already contains data, skipping migration.");
        }
    });

    db.run("ALTER TABLE domains ADD COLUMN ipPortIndex INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Error adding ipPortIndex column to domains table:", err.message);
        }
    });

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
