"use strict";

const express = require('express');
const douyinCallbackRoute = require('./douyinCallbackRoute');
const douyinManageRoute = require('./douyinManageRoute');

const router = express.Router();

// 抖音回调接口：创单、取消、Webhook 验证与事件接收。
router.use('/', douyinCallbackRoute);

// 抖音管理接口：房态同步、账号配置、映射维护、任务重试。
router.use('/', douyinManageRoute);

module.exports = router;
