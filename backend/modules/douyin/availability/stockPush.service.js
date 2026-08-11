"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const callbackLogService = require('../external/callbackLog.service');
const availabilityRepository = require('./availability.repository');
const { ACTIVE_ORDER_STATUSES } = require('./priceVolume.service');
const { buildDateList, MAX_ARIS_PER_REQUEST } = require('../calendar-room/calendarPrice.validator');

/** 创建库存推送业务错误。 */
function createServiceError(message, statusCode = 500, douyinLogId = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.douyinLogId = douyinLogId;
  return error;
}

/** 合并连续且库存、房态相同的日期。 */
function buildAris(ratePlanId, rows) {
  const aris = [];
  for (const row of rows) {
    const previous = aris[aris.length - 1];
    if (previous && previous.available === row.available && previous.inventory === row.inventory) {
      previous.timerange.end = row.date;
      continue;
    }
    aris.push({ rate_plan_id: String(ratePlanId), timerange: { start: row.date, end: row.date }, available: row.available, inventory: row.inventory });
  }
  return aris;
}

/** 推送一个已同步抖音套餐的指定日期库存。 */
async function syncRatePlanStock(localRatePlan, options) {
  const dates = buildDateList(options.startDate, options.endDate);
  if (!dates) throw createServiceError('日期范围必须为最多 30 天的真实 YYYY-MM-DD 日期', 400);
  const inventoryRows = await availabilityRepository.getInventoryRowsByRoomType(localRatePlan.room_type_code, dates, ACTIVE_ORDER_STATUSES);
  const inventoryMap = new Map(inventoryRows.map((row) => [row.stay_date, Number(row.total_rooms || 0) - Number(row.occupied_rooms || 0)]));
  const active = Number(localRatePlan.rate_plan_status) === 1 && !localRatePlan.room_type_closed;
  const aris = buildAris(localRatePlan.rate_plan_id, dates.map((date) => {
    const inventory = Math.max(inventoryMap.get(date) || 0, 0);
    return { date, inventory, available: active && inventory > 0 };
  }));
  if (aris.length > MAX_ARIS_PER_REQUEST) throw createServiceError('单次房量房态推送超过 50 组', 400);
  const accountId = String(options.accountId || douyinConfig.accountId || '').trim();
  if (!accountId) throw createServiceError('缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID', 400);
  const token = await douyinTokenService.getToken();
  let response;
  try {
    response = await fetch(`${douyinConfig.openApiBaseUrl}/goodlife/v1/trip/hotel/stock/save/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access-token': token, 'Rpc-Transit-Life-Account': accountId },
      body: JSON.stringify({ account_id: accountId, aris })
    });
  } catch (error) {
    throw createServiceError('调用抖音房量房态接口失败', 502);
  }
  const result = await response.json();
  const logId = result?.extra?.logid || result?.extra?.log_id || null;
  const saveResult = Array.isArray(result?.data?.save_result)
    ? result.data.save_result.find((item) => String(item.rate_plan_id) === String(localRatePlan.rate_plan_id))
    : null;
  const message = saveResult?.message || result?.extra?.sub_description || result?.extra?.description;
  if (!response.ok || Number(result?.extra?.error_code || 0) !== 0 || !saveResult || Number(saveResult.code) !== 0) {
    await callbackLogService.appendLog({
      type: 'stock_push',
      stage: 'error',
      logId,
      ratePlanId: localRatePlan.rate_plan_id,
      errorCode: saveResult?.code ?? result?.extra?.error_code ?? null,
      error: message || `HTTP ${response.status}`,
      saveResult: saveResult || null
    });
    throw createServiceError(message || '抖音房量房态推送失败', 502, logId);
  }
  console.log('[Douyin Stock Push] 推送成功:', { localRatePlanId: localRatePlan.local_rate_plan_id, ratePlanId: localRatePlan.rate_plan_id, logId });
  await callbackLogService.appendLog({ type: 'stock_push', stage: 'processed', logId, ratePlanId: localRatePlan.rate_plan_id, localRatePlanId: localRatePlan.local_rate_plan_id, dates });
  return { localRatePlanId: localRatePlan.local_rate_plan_id, douyinRatePlanId: localRatePlan.rate_plan_id, logId, arisCount: aris.length };
}

/** 手动推送单个本地套餐的房量房态。 */
async function syncStock(ratePlanId, options = {}) {
  const localRatePlan = await availabilityRepository.findSyncedRatePlanByLocalId(ratePlanId);
  if (!localRatePlan) throw createServiceError('套餐尚未同步为抖音售卖房型，不能推送房量房态', 400);
  return syncRatePlanStock(localRatePlan, options);
}

/** 推送当前抖音账号下受库存变动影响的套餐。 */
async function syncRoomTypeStock(roomTypeCode, startDate, endDate, source) {
  const accountId = String(douyinConfig.accountId || '').trim();
  if (!accountId) throw createServiceError('缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID', 400);

  const plans = await availabilityRepository.findSyncedRatePlansByRoomType(roomTypeCode, accountId);
  for (const plan of plans) {
    try {
      await syncRatePlanStock(plan, { startDate, endDate, accountId });
    } catch (error) {
      // 单个历史或异常套餐不能阻止同房型的其他当前套餐补推。
      console.error('[Douyin Stock Push] 自动推送失败:', {
        roomTypeCode,
        startDate,
        endDate,
        source,
        localRatePlanId: plan.local_rate_plan_id,
        ratePlanId: plan.rate_plan_id,
        message: error.message,
        douyinLogId: error.douyinLogId || null
      });
    }
  }
}

/** 在库存变动后异步补推受影响房型的指定日期。 */
function scheduleRoomTypeStockSync(roomTypeCode, startDate, endDate, source) {
  setImmediate(() => {
    syncRoomTypeStock(roomTypeCode, startDate, endDate, source).catch((error) => {
      console.error('[Douyin Stock Push] 自动推送任务失败:', { roomTypeCode, startDate, endDate, source, message: error.message, douyinLogId: error.douyinLogId || null });
    });
  });
}

module.exports = { syncStock, syncRoomTypeStock, scheduleRoomTypeStockSync };
