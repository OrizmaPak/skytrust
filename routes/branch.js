const express = require('express');
const router = express.Router();
const { getbranch } = require('../controllers/admin/branch/getoffline');

// BRANCH MANAGEMENT
router.route('/')
    .get(getbranch);

module.exports = router;