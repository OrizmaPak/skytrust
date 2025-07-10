const express = require('express');
const router = express.Router();
const rateLimiter = require('express-rate-limit');
const { signup } = require('../controllers/auth/signup');
const { login } = require('../controllers/auth/login');
const { changePassword } = require('../controllers/auth/changepassword');
const { forgotpassword } = require('../controllers/auth/forgotpassword');
const { profile } = require('../controllers/auth/profile');
const authMiddleware = require('../middleware/authentication');
const { sendverificationmail } = require('../controllers/auth/sendverificationmail');
const { signout } = require('../controllers/auth/signout');
const { verifypasswordtoken } = require('../controllers/auth/verifypasswordtoken');
const { verifyuser } = require('../controllers/auth/verifyuser');
const { testing } = require('../controllers/sample');
const { updateuser } = require('../controllers/auth/updateprofile');
const { checkUser } = require('../controllers/auth/checkuser');
const { sendOtp } = require('../controllers/auth/sendotp');
const { resetPassword } = require('../controllers/auth/resetpassword');
const { verifypasswordaccess } = require('../controllers/auth/verifypasswordaccess');
const { verifyOtp } = require('../controllers/auth/verifyotp');
const { resetPin } = require('../controllers/auth/resetpin');


router.route('/signup').post(signup);
router.route('/login').post(login);
router.route('/changepassword').post(changePassword);
router.route('/forgotpassword').post(forgotpassword); 
router.route('/profile').get(authMiddleware, profile); 
router.route('/updateprofile').post(authMiddleware, updateuser); 
router.route('/sendverificationmail').post(authMiddleware, sendverificationmail); 
router.route('/signout').get(authMiddleware, signout); 
router.route('/verifypasswordtoken').get(verifypasswordtoken); 
router.route('/verifyuser').post(verifyuser); 
router.route('/resetpassword').post(resetPassword); 
router.route('/verifypasswordaccess').post(authMiddleware, verifypasswordaccess); 
router.route('/sendotp').get(authMiddleware, sendOtp); 
router.route('/verifyotp').post(authMiddleware, verifyOtp); 
router.route('/testing').post(testing); 
router.route('/resetpin').post(authMiddleware, resetPin);
// CHECK IF USER EXIST
router.route('/checkuser')
    .get(checkUser)

 

// router.post('/login', login);
// router.patch('/updateUser', authenticateUser, testUser, updateUser);
module.exports = router;
