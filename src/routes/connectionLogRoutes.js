// src/routes/connectionLogRoutes.js
const express = require('express');
const router = express.Router();
const connectionLogController = require('../controllers/connectionLogController');
const { body, param } = require('express-validator');
const { query } = require('express-validator');

// 查全部連線紀錄（增加查詢參數的驗證）
router.get('/connection-logs', [
  query('page').optional().isInt({ gt: 0 }),
  query('pageSize').optional().isInt({ gt: 0, lt: 51 }), // 僅允許 1~50
  query('ip').optional().isIP(),
  query('username').optional().isString(),
  query('fromTime').optional().isString(),
  query('toTime').optional().isString(),
  query('server').optional().isString(),
], connectionLogController.getAllConnectionLogs);


// // 查單筆連線紀錄
// router.get('/connection-logs/:serverId', [
//     param('serverId').isUUID().withMessage('Invalid connection log id format'),
// ], connectionLogController.getConnectionLogByServerId);

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
