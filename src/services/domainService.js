// src/services/domainService.js
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/fileHandler');
const upstreamApi = require('../utils/upstreamApi');
require('dotenv').config();

const secondLevelDomain = process.env.SECOND_LEVEL_DOMAIN;

if (!secondLevelDomain) {
    throw new Error('SECOND_LEVEL_DOMAIN is not defined in the environment variables.');
};

/**
 * Get all domains
 * @returns {Array} - List of all domains
 */
const getAllDomains = () => {
    const data = readData();
    return data.domains;
};

/**
 * Get domains by server ID
 * @param {string} serverId - The server ID
 * @returns {Array} - List of domains for the server
 */
const getDomainsByServerId = (serverId) => {
    const data = readData();
    return data.domains.filter(domain => domain.serverId === serverId);
};

/**
 * Get domain by ID
 * @param {string} id - The domain ID
 * @returns {Object|null} - The domain object or null if not found
 */
const getDomainById = (id) => {
    const data = readData();
    return data.domains.find(domain => domain.id === id) || null;
};

/**
 * Create a new domain
 * @param {Object} domainData - The domain data
 * @param {string} domainData.serverId - The server ID
 * @param {string} domainData.thirdLevelDomain - The third-level domain (e.g., mc0001)
 * @returns {Promise<Object>} - The created domain object
 */
const createDomain = async (domainData) => {
    const data = readData();

    // Construct full domain name
    const fullDomain = `${domainData.thirdLevelDomain}.${secondLevelDomain}`;

    // Create new domain object
    const newDomain = {
        id: uuidv4(),
        serverId: domainData.serverId,
        thirdLevelDomain: domainData.thirdLevelDomain,
        targetIp: domainData.targetIp,
        targetPort: domainData.targetPort,
        otherData: domainData.otherData || {}
    };

    try {
        // Call upstream API to create subdomain
        const createdRecords = await upstreamApi.createSubdomain(fullDomain, newDomain.targetIp);

        // Optionally, store the record details if needed
        newDomain.cloudflareARecordId = createdRecords.aRecord ? createdRecords.aRecord.id : null;
        newDomain.cloudflareSrvRecordId = createdRecords.srvRecord ? createdRecords.srvRecord.id : null;

        // Add the new domain to data
        data.domains.push(newDomain);

        // Write updated data
        writeData(data);

        return newDomain;
    } catch (error) {
        throw new Error(`Error creating domain: ${error.message}`);
    }
};

/**
 * Update an existing domain
 * @param {string} id - The domain ID
 * @param {Object} updatedData - The updated data
 * @param {string} [updatedData.thirdLevelDomain] - The updated third-level domain
 * @param {string} [updatedData.targetIp] - The updated target IP
 * @param {number} [updatedData.targetPort] - The updated target port
 * @returns {Promise<Object|null>} - The updated domain object or null if not found
 */
const updateDomain = async (id, updatedData) => {
    const data = readData();
    const index = data.domains.findIndex(domain => domain.id === id);
    if (index === -1) return null;

    const domain = data.domains[index];
    const originalFullDomain = `${domain.thirdLevelDomain}.${secondLevelDomain}`;
    const newThirdLevelDomain = updatedData.thirdLevelDomain || domain.thirdLevelDomain;
    console.log("newThirdLevelDomain", updatedData);
    console.log("newThirdLevelDomain", newThirdLevelDomain);
    const newFullDomain = `${newThirdLevelDomain}.${secondLevelDomain}`;
    const targetIp = updatedData.targetIp || domain.targetIp;
    const targetPort = updatedData.targetPort || domain.targetPort;

    try {
        // Call upstream API to update subdomain
        const updatedRecords = await upstreamApi.updateSubdomain(originalFullDomain, newFullDomain, targetIp);

        // Update Cloudflare record IDs if they exist
        domain.cloudflareARecordId = updatedRecords.aRecord ? updatedRecords.aRecord.id : domain.cloudflareARecordId;
        domain.cloudflareSrvRecordId = updatedRecords.srvRecord ? updatedRecords.srvRecord.id : domain.cloudflareSrvRecordId;

        // Update domain data
        data.domains[index] = {
            ...domain,
            ...updatedData,
            targetIp,
            targetPort,
        };

        // Write updated data
        writeData(data);

        console.log("data.domains[index]", data.domains[index]);

        return data.domains[index];
    } catch (error) {
        throw new Error(`Error updating domain: ${error.message}`);
    }
};

/**
 * Delete a domain
 * @param {string} id - The domain ID
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
const deleteDomain = async (id) => {
    const data = readData();
    const index = data.domains.findIndex(domain => domain.id === id);
    if (index === -1) return false;

    const removedDomain = data.domains.splice(index, 1)[0];
    const fullDomain = `${removedDomain.thirdLevelDomain}.${secondLevelDomain}`; 

    try {
        // 呼叫上游 API 刪除子域名
        await upstreamApi.deleteSubdomain(fullDomain);

        // 寫入更新後的數據
        writeData(data);

        return true;
    } catch (error) {
        throw new Error(`Error deleting domain: ${error.message}`);
    }
};

/**
 * Get domains by third level domain
 * @param {string} thirdLevelDomain - The third level domain (e.g. "mc0001")
 * @returns {Array} - List of domains matching the specified third level domain
 */
const getDomainsByThirdLevelDomain = (thirdLevelDomain) => {
    const data = readData();
    return data.domains.filter(domain => domain.thirdLevelDomain === thirdLevelDomain);
};


module.exports = {
    getAllDomains,
    getDomainsByServerId,
    getDomainById,
    getDomainsByThirdLevelDomain,
    createDomain,
    updateDomain,
    deleteDomain,
};
