// src/controllers/domainController.js
const domainService = require('../services/domainService');
const { validationResult } = require('express-validator');
require('dotenv').config();

const getDomainsByThirdLevelDomain = async (req, res) => {
    try {
        const { thirdLevelDomain } = req.params;
        const domains = await domainService.getDomainsByThirdLevelDomain(thirdLevelDomain);
        return res.json(domains.map(domain => ({
            id: domain.id,
            serverId: domain.serverId,
            domain: domain.customDomain ? domain.customDomain : `${domain.thirdLevelDomain}.${process.env.DEFAULT_SUFFIX}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ipPortIndex: domain.ipPortIndex, // Include ipPortIndex
            ...JSON.parse(domain.otherData || '{}')
        })));
    } catch (error) {
        console.error(`Error fetching domains by thirdLevelDomain (${req.params.thirdLevelDomain}): ${error.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getAllDomains = async (req, res) => {
    try {
        const domains = await domainService.getAllDomains();
        return res.json(domains.map(domain => ({
            id: domain.id,
            serverId: domain.serverId,
            domain: domain.customDomain ? domain.customDomain : `${domain.thirdLevelDomain}.${process.env.DEFAULT_SUFFIX}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ipPortIndex: domain.ipPortIndex, // Include ipPortIndex
            ...JSON.parse(domain.otherData || '{}')
        })));
    } catch (error) {
        console.error(`Error fetching all domains: ${error.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getDomainsByServerId = async (req, res) => {
    try {
        const { serverId } = req.params;
        const domains = await domainService.getDomainsByServerId(serverId);
        return res.json(domains.map(domain => ({
            id: domain.id,
            serverId: domain.serverId,
            domain: domain.customDomain ? domain.customDomain : `${domain.thirdLevelDomain}.${process.env.DEFAULT_SUFFIX}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ipPortIndex: domain.ipPortIndex, // Include ipPortIndex
            ...JSON.parse(domain.otherData || '{}')
        })));
    } catch (error) {
        console.error(`Error fetching domains by server ID (${req.params.serverId}): ${error.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getDomainById = async (req, res) => {
    try {
        const domain = await domainService.getDomainById(req.params.id);
        if (!domain) return res.status(404).json({ message: 'Domain not found' });
        return res.json({
            id: domain.id,
            serverId: domain.serverId,
            domain: domain.customDomain ? domain.customDomain : `${domain.thirdLevelDomain}.${process.env.DEFAULT_SUFFIX}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ipPortIndex: domain.ipPortIndex, // Include ipPortIndex
            ...JSON.parse(domain.otherData || '{}')
        });
    } catch (error) {
        console.error(`Error fetching domain by ID (${req.params.id}): ${error.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const createDomain = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { serverId, thirdLevelDomain, targetIp, targetPort, customDomain, ...otherData } = req.body; // Removed ipPortIndex
    try {
        const domainPayload = {
            serverId,
            thirdLevelDomain,
            targetIp,
            targetPort,
            customDomain,
            otherData,
        };
        const newDomain = await domainService.createDomain(domainPayload);


        return res.status(201).json({
            id: newDomain.id,
            serverId: newDomain.serverId,
            domain: newDomain.customDomain ? newDomain.customDomain : `${newDomain.thirdLevelDomain}.${process.env.DEFAULT_SUFFIX}`,
            targetIp: newDomain.targetIp,
            targetPort: newDomain.targetPort,
            ...newDomain.otherData
        });
    } catch (error) {
        console.error(`Error creating domain: ${error.message}`);
        return res.status(500).json({ message: `Error creating domain: ${error.message}` });
    }
};

const updateDomain = async (req, res) => {
    const { id } = req.params;

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (req.body.customDomain) return res.status(400).json({ message: 'Cannot update custom domain' });

    const { ipPortIndex, serverPort, ...domainData } = req.body;

    try {
        const updatedDomain = await domainService.updateDomain(id, domainData, ipPortIndex, serverPort);
        if (!updatedDomain) return res.status(404).json({ message: 'Domain not found' });

        return res.json({
            id: updatedDomain.id,
            serverId: updatedDomain.serverId,
            domain: `${updatedDomain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
            targetIp: updatedDomain.targetIp,
            targetPort: updatedDomain.targetPort,
            ipPortIndex: updatedDomain.ipPortIndex, // Include ipPortIndex
            ...updatedDomain.otherData
        });
    } catch (error) {
        console.error(`Error updating domain (${id}): ${error.message}`);
        return res.status(500).json({ message: `Error updating domain: ${error.message}` });
    }
};

const deleteDomain = async (req, res) => {
    const { id } = req.params;

    try {
        const success = await domainService.deleteDomain(id);
        if (!success) return res.status(404).json({ message: 'Domain not found' });
        return res.status(204).send();
    } catch (error) {
        console.error(`Error deleting domain (${id}): ${error.message}`);
        return res.status(500).json({ message: `Error deleting domain: ${error.message}` });
    }
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
