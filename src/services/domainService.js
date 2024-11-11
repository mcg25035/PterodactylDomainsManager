// src/services/domainService.js
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/fileHandler');
const upstreamApi = require('../utils/upstreamApi'); // 假設有此模組
require('dotenv').config();

const secondLevelDomain = process.env.SECOND_LEVEL_DOMAIN;

if (!secondLevelDomain) {
    throw new Error('SECOND_LEVEL_DOMAIN is not defined in the environment variables.');
}

const getAllDomains = () => {
    const data = readData();
    return data.domains;
};

const getDomainsByServerId = (serverId) => {
    const data = readData();
    return data.domains.filter(domain => domain.serverId === serverId);
};

const getDomainById = (id) => {
    const data = readData();
    return data.domains.find(domain => domain.id === id);
};

const createDomain = (domainData) => {
    const data = readData();
    const newDomain = {
        id: uuidv4(),
        serverId: domainData.serverId,
        thirdLevelDomain: domainData.thirdLevelDomain,
        targetIp: domainData.targetIp,
        targetPort: domainData.targetPort,
        otherData: domainData.otherData || {}
    };
    data.domains.push(newDomain);

    // TODO: 呼叫上游網域商的 API 來建立三級網域
    // Example:
    // const fullDomain = `${newDomain.thirdLevelDomain}.${secondLevelDomain}`;
    // upstreamApi.createSubdomain(fullDomain, newDomain.targetIp, newDomain.targetPort);

    writeData(data);
    return newDomain;
};

const updateDomain = (id, updatedData) => {
    const data = readData();
    const index = data.domains.findIndex(domain => domain.id === id);
    if (index === -1) return null;

    // 更新網域資料
    data.domains[index] = {
        ...data.domains[index],
        ...updatedData
    };

    // TODO: 呼叫上游網域商的 API 來更新三級網域
    // Example:
    // const fullDomain = `${data.domains[index].thirdLevelDomain}.${secondLevelDomain}`;
    // upstreamApi.updateSubdomain(fullDomain, data.domains[index].targetIp, data.domains[index].targetPort);

    writeData(data);
    return data.domains[index];
};

const deleteDomain = (id) => {
    const data = readData();
    const index = data.domains.findIndex(domain => domain.id === id);
    if (index === -1) return false;

    const removedDomain = data.domains.splice(index, 1)[0];

    // TODO: 呼叫上游網域商的 API 來刪除三級網域
    // Example:
    // const fullDomain = `${removedDomain.thirdLevelDomain}.${secondLevelDomain}`;
    // upstreamApi.deleteSubdomain(fullDomain);

    writeData(data);
    return true;
};

module.exports = {
    getAllDomains,
    getDomainsByServerId,
    getDomainById,
    createDomain,
    updateDomain,
    deleteDomain,
};
