// src/services/connectionLogService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

/**
 * Get all connection logs
 */
function getAllConnectionLogs() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM connectionLogs', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * Get connection log by specified ID
 */
function getConnectionLogById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM connectionLogs WHERE id = ?', [id], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(null);
            resolve(row);
        });
    });
}

/**
 * Create a new connection log
 */
function createConnectionLog({ domainId, playerName, playerIp }) {
    return new Promise((resolve, reject) => {
        const id = uuidv4();
        db.run(
            `INSERT INTO connectionLogs (id, domainId, playerName, playerIp) 
             VALUES (?, ?, ?, ?)`,
            [id, domainId, playerName, playerIp],
            function (err) {
                if (err) return reject(err);

                resolve({
                    id,
                    domainId,
                    playerName,
                    playerIp,
                    // The date and time below will be the default value given by the DB; 
                    // if you want to display it immediately on the frontend, you can query the DB again.
                    // To simplify, we directly return null for connectedAt here.
                    connectedAt: null 
                });
            }
        );
    });
}

/**
 * Delete connection log by specified ID
 */
function deleteConnectionLog(id) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM connectionLogs WHERE id = ?', [id], function (err) {
            if (err) return reject(err);
            // If deleted, changes will be > 0
            resolve(this.changes > 0);
        });
    });
}

module.exports = {
    getAllConnectionLogs,
    getConnectionLogById,
    createConnectionLog,
    deleteConnectionLog
};
