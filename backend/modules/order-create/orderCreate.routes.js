const express = require('express');
const router = express.Router();
const controller = require('./orderCreate.controller');

router.post('/pricing/breakdown', controller.getPricingBreakdown);
router.post('/new', controller.createOrder);
router.post('/fast-check-in', controller.fastCheckIn);
router.post('/:orderId/check-in', controller.checkIn);

module.exports = router;
