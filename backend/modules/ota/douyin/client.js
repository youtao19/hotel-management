"use strict";

const DouyinOpenApiSdk = require('@open-dy/open_api_sdk');
const DouyinOpenApiCredential = require('@open-dy/open_api_credential');
const { toAmountNumber } = require('../../tools');
const { createDouyinError } = require('./error');

const DouyinOpenApiClient = DouyinOpenApiSdk.default;
const DouyinCredentialClient = DouyinOpenApiCredential.default;

const STOCK_SAVE_ENDPOINT = '/goodlife/v1/trip/hotel/stock/save/';
const PRICE_SAVE_ENDPOINT = '/goodlife/v1/trip/hotel/price/save/';
const RATEPLAN_SAVE_ENDPOINT = '/goodlife/v1/trip/hotel/rateplan/save/';

const sdkClientCache = new Map();
const credentialClientCache = new Map();

/**
 * 读取并清洗对象中的字符串字段。
 * @param {object} source 数据源
 * @param {string} fieldName 字段名
 * @returns {string} 清洗后的字符串
 * @throws {Error} 无
 */
function getTrimmedValue(source, fieldName) {
  return String(source?.[fieldName] || '').trim();
}

/**
 * 校验抖音账号配置中的必填字段。
 * @param {object} accountConfig 抖音账号配置
 * @param {string} fieldName 字段名
 * @param {string} fieldLabel 对外字段说明
 * @param {string} errorCode 错误码
 * @returns {string} 已校验的字段值
 * @throws {Error} 字段缺失时抛出业务异常
 */
function requireConfigValue(accountConfig, fieldName, fieldLabel, errorCode) {
  const value = getTrimmedValue(accountConfig, fieldName);
  if (!value) {
    throw createDouyinError(`${fieldLabel} 未配置`, errorCode, 503);
  }
  return value;
}

/**
 * 读取 outbox 任务中的请求载荷。
 * @param {object} task 出站任务
 * @returns {object} JSON 请求载荷
 * @throws {Error} 载荷缺失或 JSON 非法时抛出业务异常
 */
function getTaskPayload(task) {
  const payload = task?.request_payload;
  if (!payload) {
    throw createDouyinError('抖音同步任务缺少请求载荷', 'DOUYIN_OUTBOX_PAYLOAD_REQUIRED', 500);
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch (error) {
      throw createDouyinError('抖音同步任务载荷不是合法 JSON', 'DOUYIN_OUTBOX_PAYLOAD_INVALID', 500, {
        task_id: task?.id || null
      });
    }
  }

  return payload;
}

/**
 * 读取同步任务中的日期明细列表。
 * @param {object} task 出站任务
 * @returns {object[]} 同步明细列表
 * @throws {Error} 明细为空时抛出业务异常
 */
function getPayloadItems(task) {
  const payload = getTaskPayload(task);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    throw createDouyinError('抖音同步任务缺少明细数据', 'DOUYIN_OUTBOX_ITEMS_REQUIRED', 500, {
      task_id: task?.id || null
    });
  }
  return items;
}

/**
 * 从对象中按顺序读取第一个有效值。
 * @param {object} source 源对象
 * @param {string[]} fieldNames 字段名列表
 * @returns {unknown|null} 首个有效值，无值返回 null
 * @throws {Error} 无
 */
function pickValueFromFields(source, fieldNames) {
  for (const fieldName of fieldNames) {
    const fieldValue = source?.[fieldName];
    if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '') {
      return fieldValue;
    }
  }
  return null;
}

/**
 * 读取售卖房型同步载荷中的房型列表。
 * @param {object} task 出站任务
 * @returns {object[]} 房型列表
 * @throws {Error} 房型列表为空时抛出业务异常
 */
function getRatePlanRooms(task) {
  const payload = getTaskPayload(task);
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
  if (!rooms.length) {
    throw createDouyinError('售卖房型同步任务缺少 rooms 数据', 'DOUYIN_RATEPLAN_ROOMS_REQUIRED', 500, {
      task_id: task?.id || null
    });
  }
  return rooms;
}

/**
 * 生成 SDK 客户端缓存键。
 * @param {object} accountConfig 抖音账号配置
 * @returns {string} 缓存键
 * @throws {Error} 无
 */
function getClientCacheKey(accountConfig) {
  const appId = getTrimmedValue(accountConfig, 'app_id');
  const appSecret = getTrimmedValue(accountConfig, 'app_secret');
  return `${appId}:${appSecret}`;
}

/**
 * 创建或复用抖音 OpenAPI SDK 客户端。
 * @param {object} accountConfig 抖音账号配置
 * @returns {object} SDK 客户端
 * @throws {Error} 无
 */
function getSdkClient(accountConfig) {
  const cacheKey = getClientCacheKey(accountConfig);
  if (sdkClientCache.has(cacheKey)) {
    return sdkClientCache.get(cacheKey);
  }

  const client = new DouyinOpenApiClient({
    clientKey: getTrimmedValue(accountConfig, 'app_id') || 'manual-token',
    clientSecret: getTrimmedValue(accountConfig, 'app_secret') || 'manual-token'
  });

  client.setRuntimeOptions(new DouyinOpenApiSdk.RuntimeOptions({
    autoretry: true,
    ignoreSSL: false,
    maxAttempts: 2,
    readTimeout: 8000,
    connectTimeout: 3000
  }));

  sdkClientCache.set(cacheKey, client);
  return client;
}

/**
 * 创建或复用抖音 Token 凭证客户端。
 * @param {object} accountConfig 抖音账号配置
 * @returns {object} 凭证客户端
 * @throws {Error} appId 或 appSecret 缺失时抛出业务异常
 */
function getCredentialClient(accountConfig) {
  const appId = requireConfigValue(accountConfig, 'app_id', 'appId', 'DOUYIN_APP_ID_REQUIRED');
  const appSecret = requireConfigValue(accountConfig, 'app_secret', 'appSecret', 'DOUYIN_APP_SECRET_REQUIRED');
  const cacheKey = `${appId}:${appSecret}`;

  if (credentialClientCache.has(cacheKey)) {
    return credentialClientCache.get(cacheKey);
  }

  const client = new DouyinCredentialClient({
    clientKey: appId,
    clientSecret: appSecret
  });
  credentialClientCache.set(cacheKey, client);
  return client;
}

/**
 * 解析出站调用所需的 access token。
 * @param {object} accountConfig 抖音账号配置
 * @returns {Promise<string>} 可用 access token
 * @throws {Error} token 与应用凭证都缺失时抛出业务异常
 */
async function resolveAccessToken(accountConfig) {
  const manualToken = getTrimmedValue(accountConfig, 'access_token');
  if (manualToken) {
    return manualToken;
  }

  const credentialClient = getCredentialClient(accountConfig);
  const tokenResult = await credentialClient.getClientToken();
  const accessToken = String(tokenResult?.accessToken || '').trim();
  if (!accessToken) {
    throw createDouyinError('抖音 access token 获取失败', 'DOUYIN_ACCESS_TOKEN_MISSING', 503);
  }

  return accessToken;
}

/**
 * 将金额标准化为 SDK 需要的两位小数字符串。
 * @param {number|string} value 金额
 * @returns {string} 金额字符串
 * @throws {Error} 无
 */
function formatAmount(value) {
  return toAmountNumber(value).toFixed(2);
}

/**
 * 校验并读取同步所需的房型计划标识。
 * @param {object} payloadItem 单日同步明细
 * @returns {{roomId: string, ratePlanId: string, stayDate: string}} 同步标识
 * @throws {Error} 缺少房型、价格计划或日期时抛出业务异常
 */
function getRequiredSyncIdentifiers(payloadItem) {
  const roomId = String(payloadItem.room_id || '').trim();
  const ratePlanId = String(payloadItem.rate_plan_id || '').trim();
  const stayDate = String(payloadItem.stay_date || '').trim();

  if (!roomId) {
    throw createDouyinError('抖音房型 ID 缺失，无法发起 SDK 同步', 'DOUYIN_ROOM_ID_REQUIRED', 409);
  }
  if (!ratePlanId) {
    throw createDouyinError('抖音价格计划 ID 缺失，无法发起 SDK 同步', 'DOUYIN_RATE_PLAN_ID_REQUIRED', 409);
  }
  if (!stayDate) {
    throw createDouyinError('同步日期缺失，无法发起 SDK 同步', 'DOUYIN_STAY_DATE_REQUIRED', 500);
  }

  return {
    roomId,
    ratePlanId,
    stayDate
  };
}

/**
 * 将库存同步任务转换为 SDK `stockSave` 请求。
 * @param {object} accountConfig 抖音账号配置
 * @param {object} task 出站任务
 * @param {string} accessToken 调用令牌
 * @returns {object} SDK 请求对象
 * @throws {Error} 必填业务标识缺失时抛出业务异常
 */
function buildStockSaveRequest(accountConfig, task, accessToken) {
  const accountId = requireConfigValue(accountConfig, 'account_id', 'accountId', 'DOUYIN_ACCOUNT_ID_REQUIRED');
  const hotelId = requireConfigValue(accountConfig, 'hotel_id', 'hotelId', 'DOUYIN_HOTEL_ID_REQUIRED');
  const items = getPayloadItems(task);

  return new DouyinOpenApiSdk.StockSaveRequest({
    accountId,
    hotelId,
    accessToken,
    aris: items.map((item) => {
      const { roomId, ratePlanId, stayDate } = getRequiredSyncIdentifiers(item);
      const inventory = Math.max(Number(item.available_rooms || 0), 0);
      return new DouyinOpenApiSdk.StockSaveRequestArisItem({
        roomId,
        ratePlanId,
        available: inventory > 0,
        inventory: String(inventory),
        timerange: new DouyinOpenApiSdk.StockSaveRequestArisItemTimerange({
          start: stayDate,
          end: stayDate
        })
      });
    })
  });
}

/**
 * 将价格同步任务转换为 SDK `priceSave` 请求。
 * @param {object} accountConfig 抖音账号配置
 * @param {object} task 出站任务
 * @param {string} accessToken 调用令牌
 * @returns {object} SDK 请求对象
 * @throws {Error} 必填业务标识缺失时抛出业务异常
 */
function buildPriceSaveRequest(accountConfig, task, accessToken) {
  const accountId = requireConfigValue(accountConfig, 'account_id', 'accountId', 'DOUYIN_ACCOUNT_ID_REQUIRED');
  const hotelId = requireConfigValue(accountConfig, 'hotel_id', 'hotelId', 'DOUYIN_HOTEL_ID_REQUIRED');
  const items = getPayloadItems(task);

  return new DouyinOpenApiSdk.PriceSaveRequest({
    accountId,
    hotelId,
    accessToken,
    aris: items.map((item) => {
      const { roomId, ratePlanId, stayDate } = getRequiredSyncIdentifiers(item);
      const amount = formatAmount(item.price);
      return new DouyinOpenApiSdk.PriceSaveRequestArisItem({
        roomId,
        ratePlanId,
        retailAmount: amount,
        originalAmount: amount,
        amountBeforeTax: amount,
        timerange: new DouyinOpenApiSdk.PriceSaveRequestArisItemTimerange({
          start: stayDate,
          end: stayDate
        })
      });
    })
  });
}

/**
 * 将售卖房型静态信息同步任务转换为 SDK `rateplanSave` 请求。
 * @param {object} accountConfig 抖音账号配置
 * @param {object} task 出站任务
 * @param {string} accessToken 调用令牌
 * @returns {object} SDK 请求对象
 * @throws {Error} 必填字段缺失时抛出业务异常
 */
function buildRateplanSaveRequest(accountConfig, task, accessToken) {
  const accountId = requireConfigValue(accountConfig, 'account_id', 'accountId', 'DOUYIN_ACCOUNT_ID_REQUIRED');
  const configHotelId = requireConfigValue(accountConfig, 'hotel_id', 'hotelId', 'DOUYIN_HOTEL_ID_REQUIRED');
  const payload = getTaskPayload(task);
  const rooms = getRatePlanRooms(task);

  const normalizedRooms = rooms.map((room, roomIndex) => {
    const roomId = String(pickValueFromFields(room, ['room_id', 'roomId']) || '').trim();
    if (!roomId) {
      throw createDouyinError('售卖房型同步缺少 room_id', 'DOUYIN_RATEPLAN_ROOM_ID_REQUIRED', 409, {
        task_id: task?.id || null,
        room_index: roomIndex
      });
    }

    const rawRatePlans = pickValueFromFields(room, ['rate_plans', 'ratePlans']);
    const ratePlans = Array.isArray(rawRatePlans) ? rawRatePlans : [];
    if (!ratePlans.length) {
      throw createDouyinError('售卖房型同步缺少 rate_plans', 'DOUYIN_RATEPLAN_ITEMS_REQUIRED', 409, {
        task_id: task?.id || null,
        room_index: roomIndex
      });
    }

    const normalizedRatePlans = ratePlans.map((ratePlan, ratePlanIndex) => {
      const outRatePlanIdRaw = pickValueFromFields(ratePlan, ['out_rate_plan_id', 'outRatePlanId']);
      const ratePlanNameRaw = pickValueFromFields(ratePlan, ['rate_plan_name', 'ratePlanName']);
      const outRatePlanId = String(outRatePlanIdRaw || '').trim();
      const ratePlanName = String(ratePlanNameRaw || '').trim();

      if (!outRatePlanId) {
        throw createDouyinError('售卖房型同步缺少 out_rate_plan_id', 'DOUYIN_RATEPLAN_OUT_ID_REQUIRED', 409, {
          task_id: task?.id || null,
          room_index: roomIndex,
          rate_plan_index: ratePlanIndex
        });
      }
      if (!ratePlanName) {
        throw createDouyinError('售卖房型同步缺少 rate_plan_name', 'DOUYIN_RATEPLAN_NAME_REQUIRED', 409, {
          task_id: task?.id || null,
          room_index: roomIndex,
          rate_plan_index: ratePlanIndex
        });
      }

      const normalizedRatePlan = {
        outRatePlanId,
        ratePlanName
      };

      const ratePlanId = pickValueFromFields(ratePlan, ['rate_plan_id', 'ratePlanId']);
      if (ratePlanId !== null) normalizedRatePlan.ratePlanId = String(ratePlanId);

      const optionalFieldPairs = [
        ['active', 'active'],
        ['confirm_immediately', 'confirmImmediately'],
        ['confirmImmediately', 'confirmImmediately'],
        ['policy', 'policy'],
        ['settle_type', 'settleType'],
        ['settleType', 'settleType'],
        ['sales_tag', 'salesTag'],
        ['salesTag', 'salesTag'],
        ['sales_type', 'salesType'],
        ['salesType', 'salesType'],
        ['currency', 'currency'],
        ['crowd_config', 'crowdConfig'],
        ['crowdConfig', 'crowdConfig'],
        ['book_rules', 'bookRules'],
        ['bookRules', 'bookRules'],
        ['book_time_rules', 'bookTimeRules'],
        ['bookTimeRules', 'bookTimeRules'],
        ['cancel_rules', 'cancelRules'],
        ['cancelRules', 'cancelRules'],
        ['stay_rules', 'stayRules'],
        ['stayRules', 'stayRules'],
        ['hourly_room_detail', 'hourlyRoomDetail'],
        ['hourlyRoomDetail', 'hourlyRoomDetail'],
        ['invoice_provider', 'invoiceProvider'],
        ['invoiceProvider', 'invoiceProvider'],
        ['invoice', 'invoice'],
        ['meals', 'meals'],
        ['member', 'member'],
        ['packages', 'packages']
      ];

      for (const [sourceKey, targetKey] of optionalFieldPairs) {
        if (ratePlan[sourceKey] !== undefined) {
          normalizedRatePlan[targetKey] = ratePlan[sourceKey];
        }
      }

      return normalizedRatePlan;
    });

    return {
      roomId,
      ratePlans: normalizedRatePlans
    };
  });

  const payloadHotelId = String(pickValueFromFields(payload, ['hotel_id', 'hotelId']) || '').trim();
  const hotelId = payloadHotelId || configHotelId;

  return new DouyinOpenApiSdk.RateplanSaveRequest({
    accountId,
    accessToken,
    ratePlan: {
      hotelId,
      rooms: normalizedRooms
    }
  });
}

/**
 * 从候选值中读取第一个有效值。
 * @param {Array<unknown>} candidates 候选值集合
 * @returns {unknown|null} 首个有效值，无有效值则返回 null
 * @throws {Error} 无
 */
function pickFirstDefined(candidates) {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
      return candidate;
    }
  }
  return null;
}

/**
 * 解析抖音 OpenAPI 业务错误码。
 * @param {object} responsePayload SDK 原始响应
 * @returns {number|null} 业务错误码；无可识别字段返回 null
 * @throws {Error} 无
 */
function parseOpenApiErrorCode(responsePayload) {
  const rawCodes = [
    responsePayload?.data?.gwErrorCode,
    responsePayload?.data?.errorCode,
    responsePayload?.data?.error_code,
    responsePayload?.extra?.errorCode,
    responsePayload?.extra?.error_code,
    responsePayload?.gwErrorCode,
    responsePayload?.errorCode,
    responsePayload?.error_code,
    responsePayload?.code
  ];

  const normalizedCodes = rawCodes
    .map((rawCode) => (rawCode === undefined || rawCode === null || String(rawCode).trim() === '' ? null : Number(rawCode)))
    .filter((code) => code !== null && Number.isFinite(code));

  if (!normalizedCodes.length) {
    return null;
  }

  const nonZeroCode = normalizedCodes.find((code) => code !== 0);
  return nonZeroCode === undefined ? 0 : nonZeroCode;
}

/**
 * 解析抖音 OpenAPI 返回的日志追踪 ID。
 * @param {object} responsePayload SDK 原始响应
 * @returns {string|null} 日志追踪 ID，无可识别字段返回 null
 * @throws {Error} 无
 */
function parseOpenApiLogId(responsePayload) {
  const rawLogId = pickFirstDefined([
    responsePayload?.extra?.logid,
    responsePayload?.extra?.logId,
    responsePayload?.data?.logid,
    responsePayload?.data?.logId,
    responsePayload?.logid,
    responsePayload?.logId
  ]);
  return rawLogId === null ? null : String(rawLogId).trim();
}

/**
 * 解析抖音 OpenAPI 业务错误信息。
 * @param {object} responsePayload SDK 原始响应
 * @returns {string} 错误描述
 * @throws {Error} 无
 */
function parseOpenApiErrorMessage(responsePayload) {
  const rawMessage = pickFirstDefined([
    responsePayload?.data?.gwDescription,
    responsePayload?.data?.description,
    responsePayload?.data?.message,
    responsePayload?.extra?.description,
    responsePayload?.extra?.sub_description,
    responsePayload?.msg,
    responsePayload?.message,
    responsePayload?.errorMsg,
    responsePayload?.error_message
  ]);

  return rawMessage === null ? 'unknown error' : String(rawMessage);
}

/**
 * 校验抖音 OpenAPI 业务层响应是否成功。
 * 参数说明：当响应包含 error_code/gwErrorCode 且不为 0 时，判定为业务失败。
 * 返回值说明：成功时返回 void，调用方继续后续流程。
 * 异常说明：业务失败时抛出 DOUYIN_OUTBOUND_BIZ_ERROR，供 outbox 进入重试。
 * @param {object} responsePayload SDK 原始响应
 * @param {object} task 出站任务
 * @returns {void}
 * @throws {Error} 业务错误码非 0 时抛出异常
 */
function assertOpenApiSuccess(responsePayload, task) {
  const errorCode = parseOpenApiErrorCode(responsePayload);
  if (errorCode === null || errorCode === 0) {
    return;
  }
  const errorMessage = parseOpenApiErrorMessage(responsePayload);
  const logid = parseOpenApiLogId(responsePayload);

  throw createDouyinError(
    `抖音 OpenAPI 返回业务失败: ${errorMessage}`,
    'DOUYIN_OUTBOUND_BIZ_ERROR',
    502,
    {
      sync_type: task?.sync_type || null,
      task_id: task?.id || null,
      openapi_error_code: errorCode,
      openapi_error_message: errorMessage,
      openapi_logid: logid
    }
  );
}

/**
 * 选择 SDK 方法并发起同步。
 * @param {object} sdkClient SDK 客户端
 * @param {object} accountConfig 抖音账号配置
 * @param {object} task 出站任务
 * @param {string} accessToken 调用令牌
 * @returns {Promise<object>} 平台响应摘要
 * @throws {Error} 同步类型不支持时抛出业务异常
 */
async function performSdkRequest(sdkClient, accountConfig, task, accessToken) {
  if (task.sync_type === 'inventory') {
    const response = await sdkClient.stockSave(buildStockSaveRequest(accountConfig, task, accessToken));
    assertOpenApiSuccess(response, task);
    return {
      ok: true,
      mock: false,
      sdk_method: 'stockSave',
      endpoint: STOCK_SAVE_ENDPOINT,
      logid: parseOpenApiLogId(response),
      response_payload: response
    };
  }

  if (task.sync_type === 'price') {
    const response = await sdkClient.priceSave(buildPriceSaveRequest(accountConfig, task, accessToken));
    assertOpenApiSuccess(response, task);
    return {
      ok: true,
      mock: false,
      sdk_method: 'priceSave',
      endpoint: PRICE_SAVE_ENDPOINT,
      logid: parseOpenApiLogId(response),
      response_payload: response
    };
  }

  if (task.sync_type === 'rateplan') {
    const response = await sdkClient.rateplanSave(buildRateplanSaveRequest(accountConfig, task, accessToken));
    assertOpenApiSuccess(response, task);
    return {
      ok: true,
      mock: false,
      sdk_method: 'rateplanSave',
      endpoint: RATEPLAN_SAVE_ENDPOINT,
      logid: parseOpenApiLogId(response),
      response_payload: response
    };
  }

  throw createDouyinError(`不支持的同步类型 ${task.sync_type}`, 'DOUYIN_SYNC_TYPE_UNSUPPORTED', 400);
}

/**
 * 对抖音执行出站请求。测试环境支持 mock 模式，避免真实外呼。
 * @param {object} accountConfig 抖音账号配置
 * @param {object} task 出站任务
 * @returns {Promise<object>} 平台响应摘要
 * @throws {Error} SDK 调用失败时抛出业务异常
 */
async function sendSyncRequest(accountConfig, task) {
  const mockMode = String(accountConfig.mock_mode || 'none');
  const endpointMap = {
    inventory: STOCK_SAVE_ENDPOINT,
    price: PRICE_SAVE_ENDPOINT,
    rateplan: RATEPLAN_SAVE_ENDPOINT
  };
  if (mockMode === 'success') {
    return {
      ok: true,
      mock: true,
      endpoint: endpointMap[task.sync_type] || ''
    };
  }

  if (mockMode === 'fail') {
    throw createDouyinError('模拟抖音出站失败', 'DOUYIN_OUTBOUND_MOCK_FAILED', 502);
  }

  try {
    const sdkClient = getSdkClient(accountConfig);
    const accessToken = await resolveAccessToken(accountConfig);
    return await performSdkRequest(sdkClient, accountConfig, task, accessToken);
  } catch (error) {
    if (error?.code && String(error.code).startsWith('DOUYIN_')) {
      throw error;
    }

    throw createDouyinError(
      `抖音 SDK 调用失败: ${error.message || 'unknown error'}`,
      'DOUYIN_OUTBOUND_SDK_ERROR',
      502,
      {
        sync_type: task?.sync_type || null,
        task_id: task?.id || null,
        sdk_code: error?.code || null
      }
    );
  }
}

module.exports = {
  sendSyncRequest
};
