const express = require('express');
const { handleTransaction } = require('../controllers/payments/transaction');
const { performTransaction, getTransactionx } = require('../middleware/transactions/performTransaction');
const router = express.Router();



// CREATE INVENTORY
router.route('/')
    .post(handleTransaction)

router.route('/inner')
    .post(getTransactionx)


    

module.exports = router;