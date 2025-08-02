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
    console.log(domainData.customDomain);
    const fullDomain = domainData.customDomain ? domainData.customDomain : `${domainData.thirdLevelDomain}.${defaultSuffix}`;

    let { targetIp: ipToUse, targetPort: portToUse } = domainData;
    if (!domainData.customDomain) {
        let { ip, port } = getAddress(2, domainData.targetPort);
        ipToUse = ip;
        portToUse = port;
    }

    const id = uuidv4();
    let createdRecords = {};
    if (!domainData.customDomain) {
        try {
            createdRecords = await upstreamApi.createSubdomain(fullDomain, ipToUse, portToUse);
        } catch (error) {
            throw new Error(`Error creating domain: ${error.message}`);
        }
    }

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO domains (id, serverId, thirdLevelDomain, targetIp, targetPort, cloudflareARecordId, cloudflareSrvRecordId, otherData, customDomain, ipPortIndex)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                domainData.serverId,
                domainData.thirdLevelDomain,
                ipToUse,
                portToUse,
                createdRecords.aRecord ? createdRecords.aRecord.id : null,
                createdRecords.srvRecord ? createdRecords.srvRecord.id : null,
                JSON.stringify(domainData.otherData || {}),
                domainData.customDomain || null,
                2
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
                    cloudflareSrvRecordId: createdRecords.srvRecord ? createdRecords.srvRecord.id : null,
                    customDomain: domainData.customDomain || null,
                    ipPortIndex: 2
                });
            }
        );
    });
}

/**
 * @typedef {Object} Address
 * @property {string} ip - The IP address.
 * @property {number} port - The port number.
 */

/**
 * @param {number} ipPortIndex 
 * @param {number} serverPort
 * 
 * @returns {Address}
 */
function getAddress(ipPortIndex, serverPort) {
    let ip = null;
    let port = null;
    upstreamApi.getFixedEndpoints().forEach((endpoint) => {
        console.log(endpoint.id)
        console.log(ipPortIndex)

        if (endpoint.id !== ipPortIndex) return;

        if (ipPortIndex < 0) port = serverPort;
        else port = endpoint.port;

        ip = endpoint.ip;
        console.log(`Using fixed endpoint: ${endpoint.ip}:${endpoint.port}`);
    });

	if (!ip) throw new Error(`Invalid IP/Port index: ${ipPortIndex}.`);
	if (!port) throw new Error(`Invalid port for index: ${ipPortIndex}.`);

	return { ip, port };
}

async function updateDomain(id, updatedData, ipPortIndex = null, serverPort) { // Added ipPortIndex, default to 0
    const domain = await getDomainById(id);
    if (!domain) return null;

    const originalFullDomain = domain.customDomain || `${domain.thirdLevelDomain}.${defaultSuffix}`;
    const newThirdLevelDomain = updatedData.thirdLevelDomain || domain.thirdLevelDomain;
    const newFullDomain = updatedData.customDomain || `${newThirdLevelDomain}.${defaultSuffix}`; // Custom domains cannot be updated via this method based on controller logic
    
    ipPortIndex = (ipPortIndex == null) ? (domain.ipPortIndex ?? 0) : ipPortIndex;
    const otherData = updatedData.otherData ? JSON.stringify(updatedData.otherData) : domain.otherData;

    const { ip: targetIp, port: targetPort } = getAddress(ipPortIndex, serverPort);

    let updatedRecords;
    // Only call upstreamApi if it's not a custom domain being managed externally
    if (domain.customDomain) {
        throw new Error('Cannot update custom domain via this method. Please use the appropriate API for custom domains.');
    }
    try {
        // Pass ipPortIndex to upstreamApi.updateSubdomain
        updatedRecords = await upstreamApi.updateSubdomain(originalFullDomain, newFullDomain, targetIp, targetPort);        
    } catch (error) {
        throw new Error(`Error updating domain DNS records: ${error.message}`);
    }

    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE domains 
             SET thirdLevelDomain = ?, targetIp = ?, targetPort = ?, cloudflareARecordId = ?, cloudflareSrvRecordId = ?, otherData = ?, ipPortIndex = ?
             WHERE id = ?`,
            [
                newThirdLevelDomain,
                updatedRecords.aRecord ? updatedRecords.aRecord.content : targetIp, 
                targetPort,
                updatedRecords.aRecord ? updatedRecords.aRecord.id : domain.cloudflareARecordId,
                updatedRecords.srvRecord ? updatedRecords.srvRecord.id : domain.cloudflareSrvRecordId,
                otherData,
                ipPortIndex, // Add ipPortIndex to the update parameters
                id
            ],
            function (err) {
                if (err) return reject(err);

                resolve({
                    id,
                    serverId: domain.serverId,
                    thirdLevelDomain: newThirdLevelDomain,
                    targetIp: updatedRecords.aRecord ? updatedRecords.aRecord.content : targetIp,
                    targetPort,
                    otherData: otherData ? JSON.parse(otherData) : {},
                    cloudflareARecordId: updatedRecords.aRecord ? updatedRecords.aRecord.id : domain.cloudflareARecordId,
                    cloudflareSrvRecordId: updatedRecords.srvRecord ? updatedRecords.srvRecord.id : domain.cloudflareSrvRecordId,
                    ipPortIndex // Include ipPortIndex in the resolved object
                });
            }
        );
    });
}

async function deleteDomain(id) {
    const domain = await getDomainById(id);
    if (!domain) return false;

    const fullDomain = `${domain.thirdLevelDomain}.${defaultSuffix}`;

    try {
        await upstreamApi.deleteSubdomain(fullDomain);
    } catch (error) {
        console.warn(`Deleting domain ${fullDomain} is not found in Cloudflare. Deleting from database only.`);
        // throw new Error(`Error deleting domain: ${error.message}`);
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
