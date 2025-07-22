const express = require('express');
const router = express.Router();

router.get('/fixed_endpoints', domainController.getFixedEndpoints);

module.exports = router;