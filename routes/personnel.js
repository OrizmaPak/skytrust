const express = require('express');
const { saveOrUpdateLevel } = require('../controllers/personnel/level/managelevel');
const { getLevel } = require('../controllers/personnel/level/getlevel');
const { saveOrUpdateGuarantor } = require('../controllers/personnel/guarantor/manage');
const { getGuarantors } = require('../controllers/personnel/guarantor/getguarantor');
const { deleteGuarantor } = require('../controllers/personnel/guarantor/deleteguarantor');
const { deleteLevel } = require('../controllers/personnel/level/deletelevel');
const { saveOrUpdateEmploymentRecord } = require('../controllers/personnel/employmentrecord/manage');
const { getEmploymentRecords } = require('../controllers/personnel/employmentrecord/get');
const { deleteEmploymentRecord } = require('../controllers/personnel/employmentrecord/delete');
const { saveOrUpdateReferee } = require('../controllers/personnel/referee/manage');
const { getReferees } = require('../controllers/personnel/referee/get');
const { deleteReferee } = require('../controllers/personnel/referee/delete');
const { saveOrUpdateQualification } = require('../controllers/personnel/qualification/manage');
const { getQualifications } = require('../controllers/personnel/qualification/get');
const { deleteQualification } = require('../controllers/personnel/qualification/delete');
const { manageParentGuardian } = require('../controllers/personnel/parentguardian/manage');
const { getParentGuardians } = require('../controllers/personnel/parentguardian/get');
const { deleteParentGuardian } = require('../controllers/personnel/parentguardian/delete');
const { manageQuery } = require('../controllers/personnel/query/manage');
const { getQueries } = require('../controllers/personnel/query/get');
const { deleteQuery } = require('../controllers/personnel/query/delete');
const { saveOrUpdatePromotion } = require('../controllers/personnel/promotiondemotion/manage');
const { getPromotions } = require('../controllers/personnel/promotiondemotion/get');
const { saveOrUpdateTerminationResignation } = require('../controllers/personnel/terminationresignation/manage');
const { getTerminationResignation } = require('../controllers/personnel/terminationresignation/get');
const { saveOrUpdateSuspension } = require('../controllers/personnel/suspension/manage');
const { getSuspensions } = require('../controllers/personnel/suspension/get');
const { saveOrUpdateLeave } = require('../controllers/personnel/leave/manage');
const { getLeaves } = require('../controllers/personnel/leave/get');
const { deleteLeave } = require('../controllers/personnel/leave/delete');
const { saveOrUpdateWarning } = require('../controllers/personnel/warning/manage');
const { getWarnings } = require('../controllers/personnel/warning/get');
const { deleteWarning } = require('../controllers/personnel/warning/delete');
const { saveOrUpdateMonitoringEvaluation } = require('../controllers/personnel/monitoringevaluation/manage');
const { getMonitoringEvaluations } = require('../controllers/personnel/monitoringevaluation/get');
const { deleteMonitoringEvaluation } = require('../controllers/personnel/monitoringevaluation/delete');
const { getHistory } = require('../controllers/personnel/history/gethistory');
const router = express.Router();




router.route('/level')
    .post(saveOrUpdateLevel) 
    .get(getLevel)
    .delete(deleteLevel)

router.route('/guarantor')
    .post(saveOrUpdateGuarantor)
    .get(getGuarantors)
    .delete(deleteGuarantor)

router.route('/employmentrecord')
    .post(saveOrUpdateEmploymentRecord)
    .get(getEmploymentRecords)
    .delete(deleteEmploymentRecord)

router.route('/referee')
    .post(saveOrUpdateReferee)
    .get(getReferees)
    .delete(deleteReferee)

router.route('/qualification')
    .post(saveOrUpdateQualification)
    .get(getQualifications)
    .delete(deleteQualification)

router.route('/parentguardians')
    .post(manageParentGuardian)
    .get(getParentGuardians)
    .delete(deleteParentGuardian)

router.route('/query')
    .post(manageQuery)
    .get(getQueries)
    .delete(deleteQuery)

router.route('/promotiondemotion')
    .post(saveOrUpdatePromotion)
    .get(getPromotions)

router.route('/terminationresignation')
    .post(saveOrUpdateTerminationResignation)
    .get(getTerminationResignation)

router.route('/suspension')
    .post(saveOrUpdateSuspension)
    .get(getSuspensions)

router.route('/leave')
    .post(saveOrUpdateLeave)
    .get(getLeaves)
    .delete(deleteLeave)

router.route('/warning')
    .post(saveOrUpdateWarning) 
    .get(getWarnings)
    .delete(deleteWarning)

router.route('/monitoringevaluation')
    .post(saveOrUpdateMonitoringEvaluation)
    .get(getMonitoringEvaluations)
    .delete(deleteMonitoringEvaluation)

router.route('/history')
    .get(getHistory)



 
module.exports = router; 