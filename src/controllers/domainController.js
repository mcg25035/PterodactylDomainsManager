// src/controllers/domainController.js

const domainService = require('../services/domainService');
const { validationResult } = require('express-validator');
require('dotenv').config();

/**
 * Get domains by third level domain
 */
const getDomainsByThirdLevelDomain = async (req, res) => {
    try {
        const { thirdLevelDomain } = req.params;
        const domains = await domainService.getDomainsByThirdLevelDomain(thirdLevelDomain);
        res.json(domains.map(domain => ({
            id: domain.id,
            serverId: domain.serverId,
            domain: `${domain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ...domain.otherData
        })));
    } catch (error) {
        console.error(`Error fetching domains by thirdLevelDomain (${req.params.thirdLevelDomain}): ${error.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * Get all domains
 */
const getAllDomains = async (req, res) => {
    try {
        const domains = await domainService.getAllDomains();
        res.json(domains.map(domain => ({
            id: domain.id,
            serverId: domain.serverId,
            domain: `${domain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ...domain.otherData
        })));
    } catch (error) {
        console.error(`Error fetching all domains: ${error.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * Get domains by server ID
 */
const getDomainsByServerId = async (req, res) => {
    try {
        const { serverId } = req.params;
        const domains = await domainService.getDomainsByServerId(serverId);
        res.json(domains.map(domain => ({
            id: domain.id,
            serverId: domain.serverId,
            domain: `${domain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ...domain.otherData
        })));
    } catch (error) {
        console.error(`Error fetching domains by server ID (${req.params.serverId}): ${error.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * Get domain by ID
 */
const getDomainById = async (req, res) => {
    try {
        const domain = await domainService.getDomainById(req.params.id);
        if (!domain) {
            return res.status(404).json({ message: 'Domain not found' });
        }
        res.json({
            id: domain.id,
            serverId: domain.serverId,
            domain: `${domain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
            targetIp: domain.targetIp,
            targetPort: domain.targetPort,
            ...domain.otherData
        });
    } catch (error) {
        console.error(`Error fetching domain by ID (${req.params.id}): ${error.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * Create a new domain
 */
const createDomain = async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { serverId, thirdLevelDomain, targetIp, targetPort, ...otherData } = req.body;

    try {
        const newDomain = await domainService.createDomain({
            serverId,
            thirdLevelDomain,
            targetIp,
            targetPort,
            otherData
        });

        res.status(201).json({
            id: newDomain.id,
            serverId: newDomain.serverId,
            domain: `${newDomain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
            targetIp: newDomain.targetIp,
            targetPort: newDomain.targetPort,
            ...newDomain.otherData
        });
    } catch (error) {
        console.error(`Error creating domain: ${error.message}`);
        res.status(500).json({ message: `Error creating domain: ${error.message}` });
    }
};

/**
 * Update an existing domain
 */
const updateDomain = async (req, res) => {
    const { id } = req.params;

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        console.log('req.body:', req.body);
        const updatedDomain = await domainService.updateDomain(id, req.body);
        if (!updatedDomain) {
            return res.status(404).json({ message: 'Domain not found' });
        }

        res.json({
            id: updatedDomain.id,
            serverId: updatedDomain.serverId,
            domain: `${updatedDomain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
            targetIp: updatedDomain.targetIp,
            targetPort: updatedDomain.targetPort,
            ...updatedDomain.otherData
        });
    } catch (error) {
        console.error(`Error updating domain (${id}): ${error.message}`);
        res.status(500).json({ message: `Error updating domain: ${error.message}` });
    }
};

/**
 * Delete a domain
 */
const deleteDomain = async (req, res) => {
    const { id } = req.params;

    try {
        const success = await domainService.deleteDomain(id);
        if (!success) {
            return res.status(404).json({ message: 'Domain not found' });
        }
        res.status(204).send(); // No Content
    } catch (error) {
        console.error(`Error deleting domain (${id}): ${error.message}`);
        res.status(500).json({ message: `Error deleting domain: ${error.message}` });
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
