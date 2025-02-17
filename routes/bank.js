const express = require('express');
const { saveOrUpdateBank } = require('../controllers/bank/list/manage');
const { getBanks } = require('../controllers/bank/list/get');
const { saveOrUpdateRecipient } = require('../controllers/bank/reciepients/manage');
const { getRecipients } = require('../controllers/bank/reciepients/get');
const { generateTransactions } = require('../controllers/bank/generatetransactions/generate');
const router = express.Router();

// BRANCH MANAGEMENT
router.route('/list')
    .post(saveOrUpdateBank)
    .get(getBanks);

router.route('/reciepients')
    .post(saveOrUpdateRecipient)
    .get(getRecipients);

router.route('/generatetransactions')
    .post(generateTransactions);

module.exports = router;