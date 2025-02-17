const express = require('express');
const { saveOrUpdateRotaryProduct } = require('../controllers/rotary/product/mange');
const { getRotaryProduct } = require('../controllers/rotary/product/getproduct');
const { createOrUpdateRotaryAccount } = require('../controllers/rotary/account/manage');
const { getAccountsAndSchedules } = require('../controllers/rotary/account/getaccount');
const router = express.Router();



// CREATE INVENTORY
router.route('/product')
    .post(saveOrUpdateRotaryProduct)
    .get(getRotaryProduct)

router.route('/account')
    .post(createOrUpdateRotaryAccount)
    .get(getAccountsAndSchedules)




    

module.exports = router;  