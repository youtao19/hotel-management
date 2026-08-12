"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const callbackLogService = require('../external/callbackLog.service');
const repository = require('./dailyPrice.repository');
const { MAX_ARIS_PER_REQUEST, MAX_BATCH_DAYS, buildDateList } = require('./dailyPrice.validator');

/** 创建按日房价推送业务错误。 */
function createServiceError(message, statusCode = 500, douyinLogId = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.douyinLogId = douyinLogId;
  return error;
}

/** 将元转换为抖音要求的分。 */
function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

/** 将连续同价日期合并为一组房价。 */
function buildAris(ratePlanId, prices) {
  const aris = [];
  for (const price of prices) {
    const originalAmount = toCents(price.original_amount);
    const retailAmount = price.retail_amount === null ? null : toCents(price.retail_amount);
    const previous = aris[aris.length - 1];
    if (previous
      && previous.original_amount === originalAmount
      && previous.retail_amount === retailAmount) {
      previous.timerange.end = price.stay_date;
      previous.dates.push(price.stay_date);
      continue;
    }
    aris.push({
      rate_plan_id: ratePlanId,
      timerange: { start: price.stay_date, end: price.stay_date },
      original_amount: originalAmount,
      ...(retailAmount === null ? {} : { retail_amount: retailAmount }),
      dates: [price.stay_date]
    });
  }
  return aris;
}

/** 分割为符合抖音建议范围的推送批次。 */
function buildBatches(ratePlanId, prices) {
  const batches = [];
  for (let index = 0; index < prices.length; index += MAX_BATCH_DAYS) {
    const batchAris = buildAris(ratePlanId, prices.slice(index, index + MAX_BATCH_DAYS));
    if (batchAris.length > MAX_ARIS_PER_REQUEST) throw createServiceError('单次房价推送超过 50 组', 400);
    batches.push(batchAris);
  }
  return batches;
}

/** 记录房价推送的抖音日志 ID。 */
async function savePushLog(record) {
  try {
    await callbackLogService.appendLog(record);
  } catch (error) {
    console.warn('[Douyin Daily Price] 本地保存 logid 失败:', error.message);
  }
}

/** 推送指定业务的套餐按日房价。 */
async function syncDailyPrices(ratePlanId, options = {}, business) {
  const dates = buildDateList(options.startDate, options.endDate);
  if (!dates) throw createServiceError('日期范围必须为最多 30 天的真实 YYYY-MM-DD 日期', 400);

  const context = await repository.findPriceSyncContext(ratePlanId);
  if (!context) throw createServiceError('售卖套餐不存在', 404);
  if (context.douyin_business_type !== business.type) {
    throw createServiceError(`套餐不是${business.name}业务，不能推送${business.name}按日房价`, 400);
  }
  if (!context.douyin_rate_plan_id) {
    throw createServiceError('套餐尚未同步为抖音售卖房型，不能推送房价', 400);
  }

  const prices = await repository.findPrices(ratePlanId, options.startDate, options.endDate);
  const priceMap = new Map(prices.map((price) => [price.stay_date, price]));
  const missingDate = dates.find((date) => !priceMap.has(date));
  if (missingDate) throw createServiceError(`缺少 ${missingDate} 的${business.priceName || `${business.name}按日价格`}`, 400);

  const accountId = String(options.accountId || context.room_account_id || douyinConfig.accountId || '').trim();
  if (!accountId) throw createServiceError('缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID', 400);
  if (context.room_account_id && accountId !== String(context.room_account_id)) {
    throw createServiceError('抖音物理房型所属账号与当前同步账号不一致', 400);
  }
  const hotelId = String(douyinConfig.poiId || '').trim();
  if (!hotelId) throw createServiceError('缺少抖音酒店 ID，请配置 DOUYIN_POI_ID', 400);

  const token = await douyinTokenService.getToken();
  const syncedDates = [];
  const logIds = [];
  for (const aris of buildBatches(context.douyin_rate_plan_id, dates.map((date) => priceMap.get(date)))) {
    let response;
    try {
      response = await fetch(`${douyinConfig.openApiBaseUrl}/goodlife/v1/trip/hotel/price/save/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token,
          'Rpc-Transit-Life-Account': accountId
        },
        body: JSON.stringify({
          account_id: accountId,
          hotel_id: hotelId,
          aris: aris.map(({ dates: ignoredDates, ...ari }) => ari)
        })
      });
    } catch (error) {
      throw createServiceError('调用抖音房价接口失败', 502);
    }

    const result = await response.json();
    const logId = result?.extra?.logid || result?.extra?.log_id || null;
    if (logId) {
      console.log(`[Douyin ${business.name} Price] 抖音 logid: ${logId}`);
      logIds.push(logId);
    }
    const errorMessage = result?.extra?.sub_description || result?.extra?.description || result?.data?.description;
    if (!response.ok || Number(result?.extra?.error_code || 0) !== 0) {
      await savePushLog({ type: business.logType, stage: 'error', logId, ratePlanId, dates: aris.flatMap((ari) => ari.dates), error: errorMessage || `HTTP ${response.status}` });
      throw createServiceError(errorMessage || `抖音接口 HTTP ${response.status}`, 502, logId);
    }

    const saveResult = Array.isArray(result?.data?.save_result)
      ? result.data.save_result.find((item) => String(item.rate_plan_id) === String(context.douyin_rate_plan_id))
      : null;
    if (!saveResult || Number(saveResult.code) !== 0) {
      await savePushLog({ type: business.logType, stage: 'error', logId, ratePlanId, dates: aris.flatMap((ari) => ari.dates), error: saveResult?.message || '抖音房价推送失败' });
      throw createServiceError(saveResult?.message || '抖音房价推送失败', 502, logId);
    }

    const batchDates = aris.flatMap((ari) => ari.dates);
    await repository.markPricesSynced(ratePlanId, batchDates);
    await savePushLog({ type: business.logType, stage: 'processed', logId, ratePlanId, douyinRatePlanId: context.douyin_rate_plan_id, dates: batchDates });
    syncedDates.push(...batchDates);
  }

  return { success: true, ratePlanId, douyinRatePlanId: context.douyin_rate_plan_id, syncedDates, logIds };
}

module.exports = { syncDailyPrices };
