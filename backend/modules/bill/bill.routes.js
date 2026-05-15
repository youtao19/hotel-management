"use strict";

const express = require('express');
const billController = require('./bill.controller');

const router = express.Router();

router.get('/', billController.getAllBills);
router.post('/add', billController.addBill);
router.post('/other-income', billController.createOtherIncome);
router.get('/order/:orderId/details', billController.getOrderBillDetails);
router.get('/order/:orderId', billController.getBillsByOrderId);
router.get('/by-date/:date', billController.getBillsByDate);
router.post('/adjustment', billController.adjustment);
router.put('/:billId', billController.updateBill);

module.exports = router;
