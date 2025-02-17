const express = require('express');
const allocateExpenditure = require('../controllers/expenses/allocate/allocateexpenditure');
const getTransactionsAndBalance = require('../controllers/expenses/allocate/getallocateexpenditure');
const approveDeclineAllocation = require('../controllers/expenses/allocate/approvedeclineallocation');
const { getAllPayables } = require('../controllers/expenses/payables/allpayables');
const { processSupplierPayout } = require('../controllers/expenses/supplierpayout/supplierpay');
const { reversePayment } = require('../controllers/expenses/reversals/reversepayment');
const { rejectService } = require('../controllers/expenses/reversals/rejectservice');
const router = express.Router();



// CREATE INVENTORY
router.route('/allocate')
    .post(allocateExpenditure)
    .get(getTransactionsAndBalance)

router.route('/approvedeclineallocation')
    .post(approveDeclineAllocation)

router.route('/allpayables')
    .get(getAllPayables)

router.route('/payout')
    .post(processSupplierPayout)

router.route('/reversepayment')
    .post(reversePayment)

router.route('/rejectservice')    
    .post(rejectService)



    

module.exports = router; 