const express = require('express');
const { getTransactions } = require('../controllers/transactions/get');
const { getBalance } = require('../controllers/transactions/getbalance');
const { getaccountTransactions } = require('../controllers/transactions/getanaccount');
const { getAccountType } = require('../controllers/transactions/collections/getaccounttype');
const { processCollection } = require('../controllers/transactions/collections/collections');
const { getBankTransactions } = require('../controllers/transactions/getbank');
const { route } = require('./loan');
const { getUserMonthlyCollection } = require('../controllers/transactions/collections/getusermonthlycollection');
const { getUserYearlyCollection } = require('../controllers/transactions/collections/getuseryearlycollection');
const { viewCollectionsForTheDay } = require('../controllers/transactions/collections/viewcollectionsfortheday');
const { getUserMonthlyviewCollection } = require('../controllers/transactions/collections/viewcollectionsforthemonth');
const { viewCollectionsForTheYear } = require('../controllers/transactions/collections/viewcollectionsfortheyear');
const { getfullAccountType } = require('../controllers/transactions/collections/getaccountcompletetype');
const { processWithdrawal } = require('../controllers/transactions/withdrawal/cash/withdrawal');
const { processCashCollection } = require('../controllers/transactions/deposit/cash/deposit');
const router = express.Router();

 

// CREATE INVENTORY
router.route('/')
    .get(getTransactions)

router.route('/account')
    .get(getaccountTransactions)

router.route('/balance')
    .get(getBalance)

router.route('/getaccounttype')
    .get(getAccountType)

router.route('/getaccounttypefull')
    .get(getfullAccountType)

router.route('/collection')
    .post(processCollection)

router.route('/collection/usermonthly')
    .get(getUserMonthlyCollection)

router.route('/collection/useryearly')
    .get(getUserYearlyCollection)

router.route('/bank') 
    .get(getBankTransactions)

router.route('/viewcollectionsfortheday')
    .get(viewCollectionsForTheDay)

router.route('/getusermonthlycviewollection')
    .get(getUserMonthlyviewCollection)

router.route('/viewcollectionsfortheyear')
    .get(viewCollectionsForTheYear)

router.route('/deposit')
    .post(processCollection)

router.route('/withdrawal')
    .post(processWithdrawal)

router.route('/cashdeposit')
    .post(processCashCollection)

 

     

module.exports = router;  