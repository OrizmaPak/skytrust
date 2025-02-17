const express = require('express');
const { createOrUpdateAccount } = require('../controllers/glaccounts/manageaccount/manageaccount');
const { getAccounts } = require('../controllers/glaccounts/getglaccounts/getglaccounts');
const router = express.Router();



// CREATE INVENTORY
router.route('/manageglaccounts')
    .post(createOrUpdateAccount)
    .get(getAccounts);


    

module.exports = router;