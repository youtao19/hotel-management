"use strict";

const douyinTokenService = require('../token/token.service');
const { douyinConfig } = require('../../../appSettings/douyin.config');
const availabilityRepository = require('./availability.repository');

const MAX_RATE_PLAN_IDS = 50;
const MAX_DATE_RANGE_DAYS = 365;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ALLOWED_NOTIFY_SCENES = [1, 2, 3, 4];

function createServiceError(message, statusCode = 500, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.douyinLogId = details.douyinLogId || null;
  return error;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDateText(value) {
  const text = normalizeString(value);
  const match = DATE_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const days = daysFromCivil(year, month, day);
  const normalized = civilFromDays(days);

  if (normalized.year !== year || normalized.month !== month || normalized.day !== day) {
    return null;
  }

  return {
    text,
    days
  };
}

function daysFromCivil(year, month, day) {
  // 价量通知按酒店自然日校验，这里只做纯日期换算，避免把 DATE 字段转换成 UTC 时间。
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function civilFromDays(days) {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  const yearDay = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * yearDay + 2) / 153);
  const day = yearDay - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  const year = era * 400 + yearOfEra + (month <= 2 ? 1 : 0);

  return { year, month, day };
}

function getTodayDays(now = new Date()) {
  return daysFromCivil(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function normalizeLocalRatePlanIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function normalizeNotifyScenes(value) {
  if (!Array.isArray(value) || !value.length) {
    return [...ALLOWED_NOTIFY_SCENES];
  }

  const normalized = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && ALLOWED_NOTIFY_SCENES.includes(item));

  if (!normalized.length) {
    return [...ALLOWED_NOTIFY_SCENES];
  }

  return Array.from(new Set(normalized));
}

function validateDateRange(startDate, endDate, now = new Date()) {
  const start = parseDateText(startDate);
  const end = parseDateText(endDate);

  if (!start || !end) {
    throw createServiceError('日期格式必须为 YYYY-MM-DD', 400);
  }

  if (end.days < start.days) {
    throw createServiceError('结束日期不能早于开始日期', 400);
  }

  const dayCount = end.days - start.days + 1;
  if (dayCount > MAX_DATE_RANGE_DAYS) {
    throw createServiceError('日期范围不能超过 365 天', 400);
  }

  if (start.days < getTodayDays(now) - 1) {
    // 抖音允许补推近一天的价量态，继续放宽更早日期会触发无效拉取。
    throw createServiceError('开始日期不能早于当前日期前一天', 400);
  }

  return {
    start: start.text,
    end: end.text
  };
}

function getDouyinLogId(result) {
  return result?.extra?.logid
    || result?.extra?.log_id
    || result?.base_resp?.extra?.logid
    || result?.base_resp?.extra?.log_id
    || null;
}

class DouyinAriNotifyService {
  constructor(options = {}) {
    this.ratePlanRepository = options.ratePlanRepository || availabilityRepository;
    this.tokenService = options.tokenService || douyinTokenService;
    this.config = options.config || douyinConfig;
    this.fetchImpl = options.fetchImpl || ((...args) => global.fetch(...args));
    this.nowProvider = options.nowProvider || (() => new Date());
  }

  async notify(payload = {}) {
    const localRatePlanIds = normalizeLocalRatePlanIds(payload.localRatePlanIds);
    if (!localRatePlanIds.length || localRatePlanIds.length !== (Array.isArray(payload.localRatePlanIds) ? payload.localRatePlanIds.length : 0)) {
      throw createServiceError('localRatePlanIds 必须是正整数数组', 400);
    }

    if (localRatePlanIds.length > MAX_RATE_PLAN_IDS) {
      throw createServiceError('每次最多通知 50 个售卖套餐', 400);
    }

    const dateRange = validateDateRange(payload.startDate, payload.endDate, this.nowProvider());
    const accountId = normalizeString(payload.accountId) || this.config.accountId;
    if (!accountId) {
      throw createServiceError('缺少抖音商家 account_id，请传 accountId 或配置 DOUYIN_ACCOUNT_ID', 400);
    }

    const rows = await this.findDouyinRatePlans(localRatePlanIds);
    // 通知抖音前先确认本地套餐已经有真实抖音 ID，避免把未同步数据推到开放平台排队。
    this.assertAllRatePlansSynced(localRatePlanIds, rows);

    const ratePlanIds = rows.map((row) => row.douyin_rate_plan_id);
    const hotelIds = Array.from(
      new Set(
        rows
          .map((row) => normalizeString(row.hotel_id))
          .filter(Boolean)
      )
    );
    if (!hotelIds.length) {
      throw createServiceError('未找到抖音 hotel_id，无法通知抖音拉取价量态', 400);
    }
    const notifyScenes = normalizeNotifyScenes(payload.notifyScenes);
    const requestBody = {
      account_id: accountId,
      date_range: dateRange,
      hotel_ids: hotelIds,
      notify_scene: notifyScenes,
      rate_plan_ids: ratePlanIds
    };

    const token = await this.tokenService.getToken();
    const response = await this.fetchImpl(`${this.config.openApiBaseUrl}/goodlife/v1/trip/hotel/ari/notify/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'access-token': token
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    const douyinLogId = getDouyinLogId(result);
    this.assertDouyinSuccess(response, result, douyinLogId);

    console.log('[Douyin ARI Notify] 已通知抖音拉取价量态:', {
      hotelIds,
      ratePlanIds,
      notifyScenes,
      dateRange,
      douyinLogId
    });

    return {
      notified: true,
      hotelIds,
      ratePlanIds,
      notifyScenes,
      dateRange,
      douyinLogId
    };
  }

  async findDouyinRatePlans(localRatePlanIds) {
    // 抖音价量态通知只认渠道侧售卖套餐 ID，本地 ID 不能直接作为 rate_plan_id。
    return this.ratePlanRepository.findAriNotifyRatePlans(localRatePlanIds);
  }

  assertAllRatePlansSynced(localRatePlanIds, rows) {
    const rowMap = new Map(rows.map((row) => [Number(row.local_rate_plan_id), row]));
    for (const localRatePlanId of localRatePlanIds) {
      const row = rowMap.get(localRatePlanId);
      if (!row) {
        throw createServiceError(`本地售卖套餐 ${localRatePlanId} 不存在`, 404);
      }

      if (!row.douyin_rate_plan_id) {
        throw createServiceError(`本地售卖套餐 ${localRatePlanId} 尚未同步到抖音，无法通知拉取价量态`, 400);
      }

      if (!normalizeString(row.hotel_id)) {
        throw createServiceError(`本地售卖套餐 ${localRatePlanId} 缺少抖音 hotel_id，无法通知拉取价量态`, 400);
      }
    }
  }

  assertDouyinSuccess(response, result, douyinLogId) {
    if (!response.ok) {
      throw createServiceError(`抖音接口 HTTP ${response.status}: ${JSON.stringify(result)}`, 502, {
        douyinLogId
      });
    }

    // 抖音不同接口会把业务错误放在 extra 或 data 中，两处都要检查才能暴露真实失败原因。
    if (result.extra && Number(result.extra.error_code || 0) !== 0) {
      throw createServiceError(result.extra.sub_description || result.extra.description || '抖音接口调用失败', 502, {
        douyinLogId
      });
    }

    if (result.data && Number(result.data.error_code || 0) !== 0) {
      throw createServiceError(result.data.description || '抖音价量态通知失败', 502, {
        douyinLogId
      });
    }
  }
}

module.exports = new DouyinAriNotifyService();
module.exports.DouyinAriNotifyService = DouyinAriNotifyService;
module.exports.ALLOWED_NOTIFY_SCENES = ALLOWED_NOTIFY_SCENES;
module.exports.validateDateRange = validateDateRange;
module.exports.parseDateText = parseDateText;
