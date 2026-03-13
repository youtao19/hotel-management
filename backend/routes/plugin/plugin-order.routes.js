const express = require('express');
const { createPluginOrder } = require('./plugin-order.controller');
const router = express.Router();
const { pluginAuth } = require('./plugin-auth.middleware');


router.post('/orders', pluginAuth, createPluginOrder);

module.exports = router;
