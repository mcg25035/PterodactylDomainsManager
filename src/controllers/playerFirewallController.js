const playerFirewallService = require('../services/playerFirewallService');
require('dotenv').config();

const createBan = async (req, res) => {
    try {
        const ban = await playerFirewallService.createBan(req.body);
        res.status(201).json(ban);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const readBanByDomain = async (req, res) => {
    try {
        let { domain } = req.params;
        if (domain.endWith(process.env.DEFAULT_SUFFIX)) {
            domain = domain.slice(0, -process.env.DEFAULT_SUFFIX.length - 1);
        }
        
        const ban = await playerFirewallService.readBanByDomain(domain);
        res.status(200).json(ban);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const readBanByServerId = async (req, res) => {
    try {
        const { serverId } = req.params;
        const ban = await playerFirewallService.readBanByServerId(serverId);
        res.status(200).json(ban);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateBan = async (req, res) => {
    try {
        const { id } = req.params;
        const ban = await playerFirewallService.updateBan(id, req.body);
        res.status(200).json(ban);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteBan = async (req, res) => {
    try {
        const { id } = req.params;
        await playerFirewallService.deleteBan(id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createBan,
    readBanByDomain,
    readBanByServerId,
    updateBan,
    deleteBan,
};
