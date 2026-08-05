"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const channelMappingRepository = require('../channel-mapping/channelMapping.repository');
const repository = require('./calendarRoom.repository');

/** 创建日历房业务错误。 */
function createServiceError(message, statusCode = 500, douyinLogId = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.douyinLogId = douyinLogId;
  return error;
}

/** 读取物理房型所属酒店 ID。 */
function getHotelId(payload = {}) {
  return payload.hotel_id || payload.hotelId || payload.poi_id || payload.poiId || payload.hotel?.hotel_id || '';
}

/** 将套餐的日历房静态规则同步到抖音。 */
async function syncCalendarRoom(ratePlanId, options = {}) {
  const context = await repository.findSyncContext(ratePlanId);
  if (!context) throw createServiceError('售卖套餐不存在', 404);

  // 不允许预售券套餐进入日历房链路。
  if (context.douyin_business_type !== 'CALENDAR_ROOM') throw createServiceError('套餐不是日历房业务，不能同步日历房', 400);
  if (context.douyin_rate_plan_id && context.channel_config?.business_type !== 'CALENDAR_ROOM') {
    throw createServiceError('套餐已同步到预售券，不能同步日历房', 409);
  }
  if (!context.douyin_room_id || !context.cached_room_id) throw createServiceError('套餐所属房型尚未绑定抖音物理房型，无法同步', 400);

  const accountId = options.accountId || context.room_account_id || douyinConfig.accountId;
  const hotelId = options.poiId || getHotelId(context.room_payload);
  if (!accountId) throw createServiceError('缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID', 400);
  if (!hotelId) throw createServiceError('抖音物理房型缓存缺少酒店 ID，请先刷新抖音房型后再同步', 400);
  if (context.room_account_id && String(context.room_account_id) !== String(accountId)) throw createServiceError('抖音物理房型所属账号与当前同步账号不一致', 400);

  // 日历房规则必须先保存。
  const rule = await repository.findRuleByRatePlanId(ratePlanId);
  if (!rule) throw createServiceError('请先保存日历房规则', 400);

  const ratePlan = {
    rate_plan_name: context.name,
    out_rate_plan_id: String(context.id),
    validity: { start: rule.validity_start, end: rule.validity_end },
    cancel_rule: { rule: Number(rule.cancel_rule) },
    breakfast_rule: { number: Number(rule.breakfast_number) },
    refund_rule: { refundType: Number(rule.refund_type) },
    status: Number(rule.status)
  };
  if (context.douyin_rate_plan_id) ratePlan.rate_plan_id = context.douyin_rate_plan_id;
  const payload = { account_id: accountId, rate_plan: { hotel_id: hotelId, rooms: [{ room_id: context.douyin_room_id, rate_plans: [ratePlan] }] } };

  // 调用抖音日历房接口。
  let response;
  try {
    response = await fetch(`${douyinConfig.openApiBaseUrl}/goodlife/v1/trip/hotel/rateplan/save/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access-token': await douyinTokenService.getToken(), 'Rpc-Transit-Life-Account': accountId },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw createServiceError('调用抖音日历房接口失败', 502);
  }
  const result = await response.json();
  const logId = result?.extra?.logid || result?.extra?.log_id || null;
  if (logId) console.log(`[Douyin Calendar Room] 抖音 logid: ${logId}`);
  const errorMessage = result?.extra?.sub_description || result?.extra?.description || result?.data?.description;
  if (!response.ok || Number(result?.extra?.error_code || 0) !== 0) throw createServiceError(errorMessage || `抖音接口 HTTP ${response.status}`, 502, logId);
  const item = Array.isArray(result?.data?.rate_plan_map)
    ? result.data.rate_plan_map.find((entry) => String(entry.out_rate_plan_id) === String(ratePlanId))
    : null;
  if (!item || Number(item.code) !== 0 || !item.rate_plan_id) {
    throw createServiceError(item?.message || '抖音日历房同步失败', 502, logId);
  }
  // 单项成功后才保存同步映射。
  await channelMappingRepository.upsertRatePlanMapping({
    localRatePlanId: ratePlanId,
    douyinRatePlanId: item.rate_plan_id,
    syncStatus: 1,
    channelConfig: { business_type: 'CALENDAR_ROOM', out_rate_plan_id: String(ratePlanId), room_id: context.douyin_room_id, hotel_id: hotelId, account_id: accountId, log_id: logId }
  });
  return { success: true, douyinId: item.rate_plan_id, outRatePlanId: String(ratePlanId), logId };
}

module.exports = { syncCalendarRoom };
