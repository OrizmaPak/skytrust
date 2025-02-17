const express = require('express');
const router = express.Router();
const rateLimiter = require('express-rate-limit');
const { createbranch } = require('../controllers/admin/branch/create');
const { getbranch } = require('../controllers/admin/branch/get');
const { updatebranch } = require('../controllers/admin/branch/update-not-used');
const { definemembership } = require('../controllers/admin/membermanagement/definemembership');
const { getdefinedmembership } = require('../controllers/admin/membermanagement/get');
const { getdefinedmembershipposition } = require('../controllers/admin/positionbymembership/get');
const { definepositionbymembership } = require('../controllers/admin/positionbymembership/defineposition');
const { organizationsettings } = require('../controllers/admin/organizationsettings/create');
const { getorgsettings } = require('../controllers/admin/organizationsettings/get');
const { defineDepartment } = require('../controllers/admin/department/manage');
const { getDepartment } = require('../controllers/admin/department/get');
const { getActivity } = require('../controllers/admin/activity/get');
const { manageroles } = require('../controllers/admin/permissions/manageroles');
const { getRoles, getroles } = require('../controllers/admin/permissions/getroles');
const { managepermissions } = require('../controllers/admin/permissions/managepermissions');
const { managerejection } = require('../controllers/admin/transactionrejectiondate/managerejection');
const { getTransactionRejectionDate } = require('../controllers/admin/transactionrejectiondate/get');
const { getRegistrationPoint } = require('../controllers/admin/registrationpoint/get');
const { manageRegistrationPoint } = require('../controllers/admin/registrationpoint/manage');
const { manageTask } = require('../controllers/admin/task/managetask');
const { manageSubtask } = require('../controllers/admin/task/managesubtask');
const { getTask } = require('../controllers/admin/task/get');
const { manageCashierLimit } = require('../controllers/admin/cashier limit/manage');
const { getCashierLimit } = require('../controllers/admin/cashier limit/get');
const { getOnlineUsers } = require('../controllers/admin/onlineusers/get');
const { checkUser } = require('../controllers/auth/checkuser');
const { addStaffToRegistrationPoint } = require('../controllers/admin/registrationpoint/addstafftoregpoint');
const { manageMembership } = require('../controllers/admin/memberships/managemembership');
const { getMembershipMembers } = require('../controllers/admin/memberships/getmembershipmembers');
const { verifyPin } = require('../controllers/admin/pin/verifypin');
const { managePin } = require('../controllers/admin/pin/managepin');
const { blockPin } = require('../controllers/admin/pin/blockpin');

// BRANCH MANAGEMENT
router.route('/branch')
    .post(createbranch)
    .get(getbranch);

// DEPARTMENT MANAGEMENT BY BRANCH
router.route('/department')
    .post(defineDepartment)
    .get(getDepartment)

// ORGANIZATION SETTINGS
router.route('/organizationsettings')
    .post(organizationsettings)
    .get(getorgsettings);


// ORGANIZATION MEMBERSHIP SETTINGS
router.route('/organizationmembership')
    .post(definemembership)
    .get(getdefinedmembership)

// MANAGE MEMBERSHIPS
router.route('/memberships')
    .post(manageMembership) 
    .get(getMembershipMembers)

// ORGANIZATION POSITIONS BY MEMBERSHIP
router.route('/positionbymembership')
    .post(definepositionbymembership)
    .get(getdefinedmembershipposition)

// VIEW ACTIVITIES OF MEMBERS AND PERSONNELS IN THE SYSTEM
router.route('/activities')
    .get(getActivity)

// MANAGE ROLES
router.route('/manageroles')
    .post(manageroles)
    .get(getroles)

// MANAGE PERMISSIONS
router.route('/permissions')
    .post(managepermissions)

// MANAGE REJECTION TRANSACTION DATE
router.route('/rejecttransactiondate')
    .post(managerejection)
    .get(getTransactionRejectionDate)

// MANAGE REGISTRATION POINTS
router.route('/registrationpoints')
    .post(manageRegistrationPoint)
    .get(getRegistrationPoint)
router.route('/addStaffToRegistrationPoint')
    .post(addStaffToRegistrationPoint)

// MANAGE TASK SCHEDULE
router.route('/taskschedule')
    .post(manageTask)
    .get(getTask)
router.route('/subtaskschedule')
    .post(manageSubtask)

// MANAGE CASHIER LIMIT
router.route('/cashierlimit')
    .post(manageCashierLimit)
    .get(getCashierLimit) 
 
// GET ALL ONLINE USERS
router.route('/onlineusers')
    .get(getOnlineUsers)

// PIN MANAGEMENT
router.route('/verifypin')
    .post(verifyPin)

router.route('/managepin')
    .post(managePin)

router.route('/blockpin')
    .post(blockPin)



module.exports = router;