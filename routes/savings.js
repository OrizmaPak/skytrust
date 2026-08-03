const express = require('express');
const { manageSavingsProduct } = require('../controllers/savings/products/manageproduct');
const { getSavingsProducts } = require('../controllers/savings/getproduct/getproducts');
const { manageSavingsAccount } = require('../controllers/savings/createaccount/createaccount');
const { getAccounts } = require('../controllers/savings/getaccount/getaccount');
const { deleteSavingsAccount } = require('../controllers/savings/deleteaccount/deleteaccount');
const { deleteSavingsAccountTransactionHistory } = require('../controllers/savings/deleteaccount/deletetransactionhistory');
const { getFrequencyOverrides } = require('../controllers/savings/overridefrequency/getoveridefrequency');
const { saveOrUpdateFrequencyOverride } = require('../controllers/savings/overridefrequency/manageoveride');
const { getCards, manageCard, deleteCard } = require('../controllers/savings/card/manage');
const { StatusCodes } = require('http-status-codes');
const router = express.Router();



// CREATE INVENTORY
router.route('/product') 
    .post(manageSavingsProduct)
    .get(getSavingsProducts);

router.route('/account') 
    .post(manageSavingsAccount)
    .get(getAccounts);

router.route('/account/:id/history')
    .post(deleteSavingsAccountTransactionHistory)
    .delete(deleteSavingsAccountTransactionHistory)
    .get((req, res) => res.status(StatusCodes.METHOD_NOT_ALLOWED).json({
        status: false,
        message: 'Use POST or DELETE to delete transaction history for this savings account.',
        statuscode: StatusCodes.METHOD_NOT_ALLOWED,
        data: null,
        errors: ['Method not allowed']
    }));

router.route('/account/:id')
    .delete(deleteSavingsAccount);

router.route('/card')
    .get(getCards)
    .post(manageCard);

router.route('/card/:id')
    .post(manageCard)
    .put(manageCard)
    .patch(manageCard)
    .delete(deleteCard);

router.route('/overridefrequency') 
    .post(saveOrUpdateFrequencyOverride)
    .get(getFrequencyOverrides);

    

module.exports = router; 
