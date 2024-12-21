// src/routes/connectionLogRoutes.js
const express = require('express');
const router = express.Router();
const connectionLogController = require('../controllers/connectionLogController');
const { body, param } = require('express-validator');

// 查全部連線紀錄
router.get('/connection-logs', connectionLogController.getAllConnectionLogs);

// 查單筆連線紀錄
router.get('/connection-logs/:id', [
    param('id').isUUID().withMessage('Invalid connection log id format'),
], connectionLogController.getConnectionLogById);

// 新增連線紀錄
router.post('/connection-logs', [
    body('fullDomain').isString().notEmpty().withMessage('fullDomain is required'),
    body('playerName').isString().notEmpty().withMessage('playerName is required'),
    body('playerIp').isIP().withMessage('Invalid playerIp'),
], connectionLogController.createConnectionLog);

// 刪除連線紀錄
router.delete('/connection-logs/:id', [
    param('id').isUUID().withMessage('Invalid connection log id format'),
], connectionLogController.deleteConnectionLog);

module.exports = router;
