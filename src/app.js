// src/app.js
require('dotenv').config(); // 讀取 .env 檔案

const express = require('express');
const bodyParser = require('body-parser');
const domainRoutes = require('./routes/domainRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api', domainRoutes);

// 根路由
app.get('/', (req, res) => {
    res.send('PterodactylDomainsManager API is running');
});

// 錯誤處理中介軟體
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
