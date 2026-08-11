"use strict";

const express = require('express');
const service = require('./douyinSettings.service');

const router = express.Router();

/** 返回抖音支持设置，供后台页面展示当前接单模式。 */
router.get('/', async (_req, res) => {
  try {
    const settings = await service.getSettings();
    return res.status(200).json({ data: settings });
  } catch (error) {
    console.error('[Douyin Settings] 获取设置失败:', { error: error.message });
    return res.status(500).json({ message: '获取抖音设置失败' });
  }
});

/** 更新自动接单开关。 */
router.patch('/', async (req, res) => {
  try {
    const settings = await service.updateAutoConfirmEnabled(req.body?.autoConfirmEnabled, req.account);
    return res.status(200).json({ data: settings, message: settings.auto_confirm_enabled ? '已开启自动接单' : '已关闭自动接单，请在预约订单中手动处理' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('[Douyin Settings] 更新设置失败:', { accountId: req.account?.id || null, error: error.message });
    return res.status(statusCode).json({ message: error.message || '更新抖音设置失败' });
  }
});

module.exports = router;
