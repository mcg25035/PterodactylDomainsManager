// src/controllers/domainController.js
const domainService = require('../services/domainService');
const { validationResult } = require('express-validator');
require('dotenv').config();

const getAllDomains = (req, res) => {
    const domains = domainService.getAllDomains();
    res.json(domains.map(domain => ({
        id: domain.id,
        serverId: domain.serverId,
        domain: `${domain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
        targetIp: domain.targetIp,
        targetPort: domain.targetPort,
        ...domain.otherData
    })));
};

const getDomainsByServerId = (req, res) => {
    const { serverId } = req.params;
    const domains = domainService.getDomainsByServerId(serverId);
    res.json(domains.map(domain => ({
        id: domain.id,
        serverId: domain.serverId,
        domain: `${domain.thirdLevelDomain}.${process.env.SECOND_LEVEL_DOMAIN}`,
        targetIp: domain.targetIp,
        targetPort: domain.targetPort,
        ...domain.otherData
    })));
};

const getDomainById = (req, res) => {
    const domain = domainService.getDomainById(req.params.id);
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
};

const createDomain = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { serverId, thirdLevelDomain, targetIp, targetPort, ...otherData } = req.body;

    const newDomain = domainService.createDomain({
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
};

const updateDomain = (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const updatedDomain = domainService.updateDomain(id, req.body);
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
};

const deleteDomain = (req, res) => {
    const { id } = req.params;
    const success = domainService.deleteDomain(id);
    if (!success) {
        return res.status(404).json({ message: 'Domain not found' });
    }
    res.status(204).send();
};

module.exports = {
    getAllDomains,
    getDomainsByServerId,
    getDomainById,
    createDomain,
    updateDomain,
    deleteDomain,
};
