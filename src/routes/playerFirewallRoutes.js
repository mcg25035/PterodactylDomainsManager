const express = require('express');
const router = express.Router();
const playerFirewallController = require('../controllers/playerFirewallController');

router.post('/', playerFirewallController.createBan);
router.get('/domain/:domain', playerFirewallController.readBanByDomain);
router.get('/server/:serverId', playerFirewallController.readBanByServerId);
router.put('/:id', playerFirewallController.updateBan);
router.delete('/:id', playerFirewallController.deleteBan);

module.exports = router;
