const express = require('express');
const { manageLoanFee } = require('../controllers/loan/fee/manage');
const { getLoanFees } = require('../controllers/loan/fee/getfee');
const { manageLoanProduct } = require('../controllers/loan/product/manage');
const { getLoanProducts } = require('../controllers/loan/product/getproduct');
const { manageLoanAccount } = require('../controllers/loan/accounts/manage');
const { getLoanAccount } = require('../controllers/loan/accounts/getaccount');
const { getLoanAccountDetails } = require('../controllers/loan/accounts/getaccountdetails');
const { addCollateral, addOrUpdateCollateral } = require('../controllers/loan/collateral/manage');
const { getCollateral } = require('../controllers/loan/collateral/getcollateral');
const { approveDeclineCollateral } = require('../controllers/loan/collateral/manageapproval');
const { approveDeclineLoanProduct } = require('../controllers/loan/product/manageapproval');
const { updateDisbursementRef } = require('../controllers/loan/accounts/disbursements');
const router = express.Router();



// CREATE INVENTORY
router.route('/fee')
    .post(manageLoanFee)
    .get(getLoanFees)

router.route('/product')
.post(manageLoanProduct)
.get(getLoanProducts)

router.route('/approvedeclineproduct')
    .post(approveDeclineLoanProduct)

router.route('/account')
    .post(manageLoanAccount)
    .get(getLoanAccount)

router.route('/account/details')
    .post(getLoanAccountDetails)
 
router.route('/collateral')
    .post(addOrUpdateCollateral)
    .get(getCollateral)

router.route('/approvedeclinecollateral')
    .post(approveDeclineCollateral)

router.route('/disbursementref')
     .post(updateDisbursementRef)

module.exports = router;