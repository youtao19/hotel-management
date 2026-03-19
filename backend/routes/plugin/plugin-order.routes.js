const express = require('express');
const { createPluginOrder, cancelPluginOrder } = require('./plugin-order.controller');
const router = express.Router();
const { pluginAuth } = require('./plugin-auth.middleware');


router.post('/orders', pluginAuth, createPluginOrder);
// 取消订单走“更新资源状态”接口，保持 RESTful 风格。
router.patch('/orders/:platform/:otaOrderId/status', pluginAuth, cancelPluginOrder);

module.exports = router;
