const express = require('express');
const { makesales } = require('../controllers/sales/makesales');
const { viewSalesByDay } = require('../controllers/sales/viewsalesday');
const { viewSalesByMonth } = require('../controllers/sales/viewsalesmonth');
const { viewSalesByYear } = require('../controllers/sales/viewsalesyear');
const router = express.Router();



// CREATE INVENTORY
router.route('/makesales')
    .post(makesales)

router.route('/viewsalesday')
    .get(viewSalesByDay)

router.route('/viewsalesmonth')
    .get(viewSalesByMonth)

router.route('/viewsalesyear')
    .get(viewSalesByYear)

    

module.exports = router; 