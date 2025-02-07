// src/services/domainService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const upstreamApi = require('../utils/upstreamApi');
require('dotenv').config();

const defaultSuffix = process.env.DEFAULT_SUFFIX;

if (!defaultSuffix) {
    throw new Error('DEFAULT_SUFFIX is not defined in the environment variables.');
};

function getAllDomains() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM domains', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function getDomainsByServerId(serverId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM domains WHERE serverId = ?', [serverId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function getDomainById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM domains WHERE id = ?', [id], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(null);
            resolve(row);
        });
    });
}

function getDomainsByThirdLevelDomain(thirdLevelDomain) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM domains WHERE thirdLevelDomain = ?', [thirdLevelDomain], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function createDomain(domainData) {
    const fullDomain = domainData.customDomain ? domainData.customDomain : `${domainData.thirdLevelDomain}.${defaultSuffix}`;

    const id = uuidv4();
    let createdRecords = {};
    if (!domainData.customDomain) {
        try {
            createdRecords = await upstreamApi.createSubdomain(fullDomain, domainData.targetIp);
        } catch (error) {
            throw new Error(`Error creating domain: ${error.message}`);
        }
    }

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO domains (id, serverId, thirdLevelDomain, targetIp, targetPort, cloudflareARecordId, cloudflareSrvRecordId, otherData)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                domainData.serverId,
                domainData.thirdLevelDomain,
                domainData.targetIp,
                domainData.targetPort,
                createdRecords.aRecord ? createdRecords.aRecord.id : null,
                createdRecords.srvRecord ? createdRecords.srvRecord.id : null,
                JSON.stringify(domainData.otherData || {})
            ],
            (err) => {
                if (err) return reject(err);
                resolve({
                    id,
                    serverId: domainData.serverId,
                    thirdLevelDomain: domainData.thirdLevelDomain,
                    targetIp: domainData.targetIp,
                    targetPort: domainData.targetPort,
                    otherData: domainData.otherData || {},
                    cloudflareARecordId: createdRecords.aRecord ? createdRecords.aRecord.id : null,
                    cloudflareSrvRecordId: createdRecords.srvRecord ? createdRecords.srvRecord.id : null
                });
            }
        );
    });
}

async function updateDomain(id, updatedData) {
    const domain = await getDomainById(id);
    if (!domain) return null;

    const originalFullDomain = domain.customDomain || `${domain.thirdLevelDomain}.${defaultSuffix}`;
    const newThirdLevelDomain = updatedData.thirdLevelDomain || domain.thirdLevelDomain;
    const newFullDomain = updatedData.customDomain || `${newThirdLevelDomain}.${defaultSuffix}`;
    const targetIp = updatedData.targetIp || domain.targetIp;
    const targetPort = updatedData.targetPort || domain.targetPort;
    const otherData = updatedData.otherData ? JSON.stringify(updatedData.otherData) : domain.otherData;

    let updatedRecords;
    try {
        updatedRecords = await upstreamApi.updateSubdomain(originalFullDomain, newFullDomain, targetIp);
    } catch (error) {
        throw new Error(`Error updating domain: ${error.message}`);
    }

    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE domains 
             SET thirdLevelDomain = ?, targetIp = ?, targetPort = ?, cloudflareARecordId = ?, cloudflareSrvRecordId = ?, otherData = ?
             WHERE id = ?`,
            [
                newThirdLevelDomain,
                targetIp,
                targetPort,
                updatedRecords.aRecord ? updatedRecords.aRecord.id : domain.cloudflareARecordId,
                updatedRecords.srvRecord ? updatedRecords.srvRecord.id : domain.cloudflareSrvRecordId,
                otherData,
                id
            ],
            function (err) {
                if (err) return reject(err);

                resolve({
                    id,
                    serverId: domain.serverId,
                    thirdLevelDomain: newThirdLevelDomain,
                    targetIp,
                    targetPort,
                    otherData: otherData ? JSON.parse(otherData) : {},
                    cloudflareARecordId: updatedRecords.aRecord ? updatedRecords.aRecord.id : domain.cloudflareARecordId,
                    cloudflareSrvRecordId: updatedRecords.srvRecord ? updatedRecords.srvRecord.id : domain.cloudflareSrvRecordId
                });
            }
        );
    });
}

async function deleteDomain(id) {
    const domain = await getDomainById(id);
    if (!domain) return false;

    const fullDomain = `${domain.thirdLevelDomain}.${secondLevelDomain}`;

    try {
        await upstreamApi.deleteSubdomain(fullDomain);
    } catch (error) {
        throw new Error(`Error deleting domain: ${error.message}`);
    }

    return new Promise((resolve, reject) => {
        db.run('DELETE FROM domains WHERE id = ?', [id], function(err) {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

module.exports = {
    getAllDomains,
    getDomainsByServerId,
    getDomainById,
    getDomainsByThirdLevelDomain,
    createDomain,
    updateDomain,
    deleteDomain,
};
