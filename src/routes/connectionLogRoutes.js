// src/routes/connectionLogRoutes.js
const express = require('express');
const router = express.Router();
const connectionLogController = require('../controllers/connectionLogController');
const { body, param } = require('express-validator');

// 取得所有連線紀錄
router.get('/connection-logs', connectionLogController.getAllConnectionLogs);

// 取得指定 ID 的連線紀錄
router.get('/connection-logs/:id', [
    param('id').isUUID().withMessage('Invalid log id format')
], connectionLogController.getConnectionLogById);

// 新增一筆連線紀錄
router.post('/connection-logs', [
    body('domainId').isUUID().withMessage('Invalid domainId format'),
    body('playerName').isString().notEmpty().withMessage('playerName is required'),
    body('playerIp').isIP().withMessage('Invalid player IP address')
], connectionLogController.createConnectionLog);

// 刪除一筆連線紀錄
router.delete('/connection-logs/:id', [
    param('id').isUUID().withMessage('Invalid log id format')
], connectionLogController.deleteConnectionLog);

module.exports = router;
