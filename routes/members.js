const express = require('express');
const { registeruser } = require('../controllers/member/registeruser/create');
const { getUsers } = require('../controllers/member/getmembers/getmembers');
const { findUsers } = require('../controllers/member/getmembers/findUser');
const router = express.Router();



// CREATE INVENTORY
router.route('/userregistration')
    .post(registeruser)
    .get(getUsers)
router.route('/finduser')
    .get(findUsers)


    

module.exports = router;  