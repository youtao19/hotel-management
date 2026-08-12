"use strict";

const express = require('express');
const repository = require('./dailyPrice.repository');
const { normalizePrices, validatePrices, buildDateList } = require('./dailyPrice.validator');

/** 创建指定抖音业务的按日房价接口。 */
function createDailyPriceRouter(business) {
  const router = express.Router({ mergeParams: true });

  /** 解析正整数套餐 ID。 */
  function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /** 校验套餐属于当前接口的业务类型。 */
  async function ensureBusinessContext(ratePlanId) {
    const context = await repository.findPriceSyncContext(ratePlanId);
    if (!context) return { message: '售卖套餐不存在', statusCode: 404 };
    if (context.douyin_business_type !== business.type) {
      return { message: `套餐不是${business.name}业务，不能维护${business.name}按日房价`, statusCode: 400 };
    }
    return { context };
  }

  /** 保存当前业务的按日价格。 */
  router.put('/prices', async (req, res) => {
    try {
      const ratePlanId = parseId(req.params.id);
      if (!ratePlanId) return res.status(400).json({ message: '套餐ID格式错误' });
      const businessContext = await ensureBusinessContext(ratePlanId);
      if (businessContext.message) return res.status(businessContext.statusCode).json({ message: businessContext.message });
      const message = validatePrices(req.body || {});
      if (message) return res.status(400).json({ message });
      const prices = normalizePrices(req.body || {});
      const saved = await repository.upsertPrices(ratePlanId, prices);
      return res.status(200).json({ data: saved, message: `${business.name}按日房价保存成功` });
    } catch (error) {
      console.error(`保存${business.name}按日房价失败:`, error);
      return res.status(500).json({ message: '服务器错误', error: error.message });
    }
  });

  /** 查询当前业务的按日价格。 */
  router.get('/prices', async (req, res) => {
    try {
      const ratePlanId = parseId(req.params.id);
      if (!ratePlanId) return res.status(400).json({ message: '套餐ID格式错误' });
      const businessContext = await ensureBusinessContext(ratePlanId);
      if (businessContext.message) return res.status(businessContext.statusCode).json({ message: businessContext.message });
      const startDate = String(req.query.startDate || '').trim();
      const endDate = String(req.query.endDate || '').trim();
      if (!buildDateList(startDate, endDate)) return res.status(400).json({ message: '日期范围必须为最多 30 天的真实 YYYY-MM-DD 日期' });
      const prices = await repository.findPrices(ratePlanId, startDate, endDate);
      return res.status(200).json({ data: prices, message: `${business.name}按日房价获取成功` });
    } catch (error) {
      console.error(`获取${business.name}按日房价失败:`, error);
      return res.status(500).json({ message: '服务器错误', error: error.message });
    }
  });

  /** 推送当前业务的按日价格。 */
  router.post('/prices/sync', async (req, res) => {
    try {
      const ratePlanId = parseId(req.params.id);
      if (!ratePlanId) return res.status(400).json({ message: '套餐ID格式错误' });
      const result = await business.syncPrices(ratePlanId, req.body || {});
      return res.status(200).json({ data: result, message: `${business.name}按日房价推送成功` });
    } catch (error) {
      const statusCode = Number(error.statusCode) || 500;
      const log = statusCode >= 500 ? console.error : console.warn;
      log(`推送${business.name}按日房价失败:`, error.message);
      if (error.douyinLogId) log('抖音 logid:', error.douyinLogId);
      return res.status(statusCode).json({ message: error.message, douyin_log_id: error.douyinLogId || null });
    }
  });

  return router;
}

module.exports = { createDailyPriceRouter };
