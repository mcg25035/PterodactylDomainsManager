// src/routes/domainRoutes.js
const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domainController');
const { body, param } = require('express-validator');

// 獲取所有網域
router.get('/domains', domainController.getAllDomains);

// 根據伺服器 UUID 獲取相關網域
router.get('/servers/:serverId/domains', [
    param('serverId').isUUID().withMessage('Invalid serverId format')
], domainController.getDomainsByServerId);

// 獲取特定網域
router.get('/domains/:id', [
    param('id').isUUID().withMessage('Invalid domain id format')
], domainController.getDomainById);

// 創建網域
router.post('/domains', [
    body('serverId').isUUID().withMessage('Invalid serverId format'),
    body('thirdLevelDomain').isString().notEmpty().withMessage('thirdLevelDomain is required'),
    body('targetIp').isIP().withMessage('Invalid target IP address'),
    body('targetPort').isInt({ min: 1, max: 65535 }).withMessage('Invalid target port'),
    body('customDomain').optional().isString().matches(/^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/).withMessage('Invalid custom domain format')
], domainController.createDomain);

// 更新網域
router.put('/domains/:id', [
    param('id').isUUID().withMessage('Invalid domain id format'),
    body('thirdLevelDomain').optional().isString().notEmpty().withMessage('thirdLevelDomain must be a non-empty string'),
    body('targetIp').optional().isIP().withMessage('Invalid target IP address'),
    body('targetPort').optional().isInt({ min: 1, max: 65535 }).withMessage('Invalid target port'),
    body('customDomain').optional().isString().withMessage('Invalid custom domain'),
    body('ipPortIndex').optional().isInt({ min: 0 }).withMessage('ipPortIndex must be a non-negative integer')
], domainController.updateDomain);

// 刪除網域
router.delete('/domains/:id', [
    param('id').isUUID().withMessage('Invalid domain id format')
], domainController.deleteDomain);

// 根據 thirdLevelDomain 獲取相關網域
router.get('/domains/third/:thirdLevelDomain', [
    param('thirdLevelDomain').isString().notEmpty().withMessage('Invalid thirdLevelDomain format')
], domainController.getDomainsByThirdLevelDomain);


module.exports = router;
