const express = require('express');
const { createOrUpdateAccount } = require('../controllers/glaccounts/manageaccount/manageaccount');
const { getAccounts } = require('../controllers/glaccounts/getglaccounts/getglaccounts');
const { deleteAccount } = require('../controllers/glaccounts/deleteaccount/deleteaccount');
const router = express.Router();



// CREATE INVENTORY
router.route('/manageglaccounts')
    .post(createOrUpdateAccount)
    .get(getAccounts);

router.route('/manageglaccounts/:id')
    .delete(deleteAccount);

    

module.exports = router;
