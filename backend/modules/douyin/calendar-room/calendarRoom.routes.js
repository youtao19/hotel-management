"use strict";

const express = require('express');
const repository = require('./calendarRoom.repository');
const { normalizeRule, validateRule } = require('./calendarRoom.validator');
const { syncCalendarRoom } = require('./calendarRoom.service');
const { syncStock } = require('../availability/stockPush.service');

const router = express.Router({ mergeParams: true });

/** 解析正整数套餐 ID。 */
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** 保存日历房规则。 */
router.put('/rule', async (req, res) => {
  try {
    const ratePlanId = parseId(req.params.id);
    if (!ratePlanId) return res.status(400).json({ message: '套餐ID格式错误' });
    const context = await repository.findSyncContext(ratePlanId);
    if (!context) return res.status(404).json({ message: '售卖套餐不存在' });
    if (context.douyin_business_type !== 'CALENDAR_ROOM') return res.status(400).json({ message: '套餐不是日历房业务，不能保存日历房规则' });
    const rule = normalizeRule(req.body || {});
    const message = validateRule(rule);
    if (message) return res.status(400).json({ message });
    const saved = await repository.upsertRule(ratePlanId, rule);
    return res.status(200).json({ data: saved, message: '日历房规则保存成功' });
  } catch (error) {
    console.error('保存日历房规则失败:', error);
    return res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

/** 查询日历房规则。 */
router.get('/rule', async (req, res) => {
  try {
    const ratePlanId = parseId(req.params.id);
    if (!ratePlanId) return res.status(400).json({ message: '套餐ID格式错误' });
    const rule = await repository.findRuleByRatePlanId(ratePlanId);
    return res.status(200).json({ data: rule, message: '日历房规则获取成功' });
  } catch (error) {
    console.error('获取日历房规则失败:', error);
    return res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

/** 手动推送套餐指定日期的房量房态。 */
router.post('/stock/sync', async (req, res) => {
  try {
    const ratePlanId = parseId(req.params.id);
    if (!ratePlanId) return res.status(400).json({ message: '套餐ID格式错误' });
    const result = await syncStock(ratePlanId, req.body || {});
    return res.status(200).json({ data: result, message: '抖音房量房态推送成功' });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (error.douyinLogId) console.error('推送抖音房量房态失败，logid:', error.douyinLogId);
    return res.status(statusCode).json({ message: error.message, douyin_log_id: error.douyinLogId || null });
  }
});

/** 同步日历房静态信息。 */
router.post('/sync', async (req, res) => {
  try {
    const ratePlanId = parseId(req.params.id);
    if (!ratePlanId) return res.status(400).json({ message: '套餐ID格式错误' });
    const result = await syncCalendarRoom(ratePlanId, req.body || {});
    return res.status(200).json({ data: { douyin: result }, message: '日历房同步抖音成功' });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    return res.status(statusCode).json({ message: error.message, douyin_log_id: error.douyinLogId || null });
  }
});

module.exports = router;
