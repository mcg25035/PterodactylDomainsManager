// src/app.js
require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const domainRoutes = require('./routes/domainRoutes');
const apiKeyMiddleware = require('./middleware/apiKeyMiddleware'); // Import middleware

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(apiKeyMiddleware); // Apply API key middleware to all routes

// Routes
app.use('/api', domainRoutes);

// Root route
app.get('/', (req, res) => {
    res.send('PterodactylDomainsManager API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
