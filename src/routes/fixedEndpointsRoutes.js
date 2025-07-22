const express = require('express');
const fixedEndpointsController = require('../controllers/fixedEndpointsController');
const router = express.Router();


router.get('/fixed_endpoints', fixedEndpointsController.getFixedEndpoints);

module.exports = router;