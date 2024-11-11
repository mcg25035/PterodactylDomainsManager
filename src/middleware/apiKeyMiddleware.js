// src/middleware/apiKeyMiddleware.js
require('dotenv').config();

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error('API_KEY is not defined in the environment variables.');
}

const apiKeyMiddleware = (req, res, next) => {
    const requestApiKey = req.header('x-api-key');

    if (!requestApiKey) {
        return res.status(401).json({ message: 'API key is missing' });
    }

    if (requestApiKey !== API_KEY) {
        return res.status(403).json({ message: 'Invalid API key' });
    }

    next();
};

module.exports = apiKeyMiddleware;
