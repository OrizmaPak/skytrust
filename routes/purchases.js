const express = require('express');
const { manageSupplier } = require('../controllers/purchases/supplier/managesupplier');
const { getSupplier } = require('../controllers/purchases/supplier/getsupplier');
const { getPurchaseOrder } = require('../controllers/purchases/purchase order/getpurchaseorder');
const { managePurchaseOrder } = require('../controllers/purchases/purchase order/managepurchaseorder');
const { deletePurchaseOrder } = require('../controllers/purchases/purchase order/deletepurchaseorder');
const { manageReceivePurchases } = require('../controllers/purchases/receive purchases/managereceivepurchases');
const { getReceivePurchases } = require('../controllers/purchases/receive purchases/getreceivepurchases');
const { getServices } = require('../controllers/purchases/service/getserviceorder');
const { saveOrUpdateServices } = require('../controllers/purchases/service/serviceorder');
const { manageReceiveService } = require('../controllers/purchases/service/receiveservice');
const { getServicesReceived } = require('../controllers/purchases/service/getservicereceived');
const { deleteServiceOrder } = require('../controllers/purchases/service/deleteserviceorder');
const { getRejectedServicesReceived } = require('../controllers/purchases/service/getrejectedservicereceived');
const router = express.Router();



// CREATE INVENTORY
router.route('/supplier')
    .post(manageSupplier)
    .get(getSupplier)

router.route('/order')
    .post(managePurchaseOrder)
    .get(getPurchaseOrder)
    .delete(deletePurchaseOrder)

router.route('/purchase')
    .post(manageReceivePurchases)
    .get(getReceivePurchases)

router.route('/serviceorder')
    .post(saveOrUpdateServices)
    .get(getServices)
    .delete(deleteServiceOrder) 

router.route('/service')
    .post(manageReceiveService)
    .get(getServicesReceived) 

router.route('/rejectedservicereceived') 
    .get(getRejectedServicesReceived)  
 

    

module.exports = router;    