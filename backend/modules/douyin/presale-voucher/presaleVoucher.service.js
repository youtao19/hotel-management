"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const repository = require('./presaleVoucher.repository');

/** 统一携带状态码和抖音logid，控制器据此向前端返回可排查错误。 */
function createServiceError(message, statusCode = 500, douyinLogId = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.douyinLogId = douyinLogId;
  return error;
}

/** 本地金额固定按元存储，抖音预售券接口要求分，避免在页面层混用单位。 */
function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

/** 将运营按元配置的指定日期加价规则映射为抖音按分的契约。 */
function buildMarkupInfo(markupRules = []) {
  return markupRules.map((rule) => ({
    markup_amount: toCents(rule.amount),
    markup_date_type: 1,
    markup_days: { from: rule.startDate, to: rule.endDate },
    ...(Array.isArray(rule.weekdays) && rule.weekdays.length ? { markup_days_of_week: rule.weekdays } : {})
  }));
}

/** 兼容抖音常见的logid字段位置，保证失败信息可回溯。 */
function getLogId(result) {
  return result?.extra?.logid || result?.extra?.log_id || null;
}

/** 将本地预售券状态操作映射为抖音商品操作枚举。 */
function getProductOperationType(operation) {
  return { ONLINE: 1, OFFLINE: 2 }[operation] || null;
}

/** 从抖音响应中读取当前商品的单项处理结果。 */
function getProductOperationResult(result, productId) {
  if (!Array.isArray(result?.data)) return result?.data || {};
  return result.data.find((item) => String(item.product_id) === String(productId)) || result.data[0] || {};
}

/** 判断抖音顶层或单项响应是否返回了业务失败码。 */
function hasBusinessError(result, item) {
  const codes = [result?.extra?.error_code, item?.error_code, item?.code];
  return codes.some((code) => code !== undefined && code !== null && code !== '' && Number(code) !== 0);
}

/** 变更已同步预售券的抖音商品上架状态。 */
async function updateVoucherProductStatus(id, operation) {
  const voucher = await repository.findById(id);
  if (!voucher) throw createServiceError('预售券不存在', 404);
  const opType = getProductOperationType(operation);
  if (!opType) throw createServiceError('操作类型仅支持 ONLINE 或 OFFLINE', 400);
  if (Number(voucher.sync_status) !== 1 || !voucher.douyin_voucher_id) {
    throw createServiceError('预售券尚未成功同步到抖音，不能修改商品状态', 400);
  }
  const accountId = douyinConfig.accountId;
  if (!accountId) throw createServiceError('缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID', 400);

  const productId = voucher.douyin_voucher_id;
  let response;
  try {
    response = await fetch(`${douyinConfig.openApiBaseUrl}/goodlife/v1/trip/product/operate/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': await douyinTokenService.getToken(),
        'Rpc-Transit-Life-Account': accountId
      },
      body: JSON.stringify({ account_id: accountId, product_id_list: [productId], op_type: opType })
    });
  } catch (error) {
    console.error('[Douyin Presale Voucher] 商品状态请求失败:', { voucherId: voucher.id, productId, operation, message: error.message });
    await repository.markProductStatusResult(id, { logId: null, errorMessage: '调用抖音商品状态接口失败' });
    throw createServiceError('调用抖音商品状态接口失败', 502);
  }

  const result = await response.json();
  const logId = getLogId(result);
  const item = getProductOperationResult(result, productId);
  const errorMessage = item?.message || item?.description || result?.extra?.sub_description || result?.extra?.description || '抖音商品状态操作失败';
  console.log('[Douyin Presale Voucher] 商品状态响应:', {
    voucherId: voucher.id,
    productId,
    operation,
    httpStatus: response.status,
    errorCode: item?.error_code ?? item?.code ?? result?.extra?.error_code ?? null,
    douyinLogId: logId || null
  });
  if (!response.ok || hasBusinessError(result, item)) {
    await repository.markProductStatusResult(id, { logId, errorMessage });
    throw createServiceError(errorMessage, 502, logId);
  }

  const productStatus = operation === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
  const updatedVoucher = await repository.markProductStatusResult(id, { productStatus, logId, errorMessage: null });
  return { voucher: updatedVoucher, operation, logId };
}

/**
 * 创建或更新预售券；本地ID固定映射为out_id，使重复同步始终覆盖同一张抖音券。
 */
async function syncVoucher(id) {
  const voucher = await repository.findById(id);
  if (!voucher) throw createServiceError('预售券不存在', 404);
  if (!voucher.douyin_rate_plan_id) {
    throw createServiceError('绑定套餐尚未同步为抖音预定商品，无法创建预售券', 400);
  }
  // 预售券与酒店套餐共用同一来客账户，避免通过额外环境变量覆盖已验证的商家路由。
  const accountId = douyinConfig.accountId;
  if (!accountId) throw createServiceError('缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID', 400);

  const imageUrls = Array.isArray(voucher.image_urls) ? voucher.image_urls : [];
  const markupRules = Array.isArray(voucher.markup_rules) ? voucher.markup_rules : [];
  const payload = {
    account_id: accountId,
    presale_info: {
      // 已有抖音券更新时必须携带券ID，避免同一out_id被识别为重复新建。
      ...(voucher.douyin_voucher_id ? { pre_sale_coupon_id: voucher.douyin_voucher_id } : {}),
      // 已同步物理房型均使用此酒店类目，预售券必须与已上架的酒店商品保持同一酒店类目体系。
      category_id: '8001001',
      // account_id 按抖音规范传总账户，因此结算必须明确指定总店，避免渠道无法推断资金归属。
      settle_type: 1,
      pre_sale_coupon_info: {
        coupon_name: voucher.name,
        apply_room_number: 1,
        apply_nights: 1,
        bind_rate_plans: [voucher.douyin_rate_plan_id],
        imange_list: imageUrls.map((imageUrl, index) => ({ image_type: index === 0 ? 1 : 2, image_url: imageUrl })),
        original_amount: toCents(voucher.original_amount),
        actual_amount: toCents(voucher.actual_amount),
        // 固定按天加价是预售券创建时声明的模式；空规则数组用于清除已同步的历史加价日期。
        markup_type: 1,
        markup_info: buildMarkupInfo(markupRules),
        sales_type: 1,
        coupon_separate: false
      },
      sale_info: {
        show_channel: 1,
        inventory_info: voucher.inventory_is_limited ? { is_limit: true, num: voucher.inventory_count } : { is_limit: false },
        sale_date: { from: voucher.sale_start_at, to: voucher.sale_end_at },
        book_date: { from: voucher.book_start_date, to: voucher.book_end_date },
        is_auto_extension: false
      },
      trade_info: {
        // 抖音区分“可预约日期”和“顾客可使用日期”，一期将两者保持一致，避免券售出后存在不可用日期。
        customer_can_use_date: {
          use_date_type: 1,
          use_date: { from: voucher.book_start_date, to: voucher.book_end_date }
        },
        // 当前没有按时段核销能力，明确传全天可用，避免抖音把缺省值识别为未配置。
        customer_can_use_time: { use_time_type: 1 },
        // 购买上限由运营配置并随券同步，避免单用户累计或单笔购买超过履约能力。
        limt_buy_rule: {
          each_person_max: voucher.each_person_max,
          each_person_each_order_max: voucher.each_person_each_order_max
        },
        // 抖音要求提前预约天数为正数且不超过30天，一期采用官方示例的30天规则。
        book_rule: { earliest_book_day: 30 },
        // 可取消对应抖音的未使用自动退；限时与阶梯价取消另需时间或扣费配置。
        cancel_booking_rule: { cancel_type: voucher.cancel_booking_type },
        // 当前未接入独立开票服务，按抖音预售券接口示例声明由商家侧提供发票。
        invoic_info: { provider: 1 }
      },
      // 一期尚未维护券专属入住时间和说明，先使用酒店预售券官方示例默认值；后续应开放为运营配置。
      note_info: {
        check_time_range: { from: '14:00', to: '12:00' },
        other_remark_info: ['需提前预约，以门店确认为准'],
        service_for_foreign: false,
        superimposed_discounts: false
      },
      out_id: `voucher-${voucher.id}`,
      currency: 'CNY'
    },
    ability: { ignore_inapplicable_poi: false }
  };

  // 只记录业务定位字段，不记录券图片URL、完整请求体或access token，避免日志泄露运营素材和凭证。
  console.log('[Douyin Presale Voucher] 开始同步:', {
    voucherId: voucher.id,
    outId: payload.presale_info.out_id,
    accountId,
    accountIdSource: 'DOUYIN_ACCOUNT_ID',
    ratePlanId: voucher.rate_plan_id,
    douyinRatePlanId: voucher.douyin_rate_plan_id,
    douyinVoucherId: voucher.douyin_voucher_id || null,
    actualAmount: payload.presale_info.pre_sale_coupon_info.actual_amount,
    cancelBookingType: payload.presale_info.trade_info.cancel_booking_rule.cancel_type,
    markupRuleCount: markupRules.length,
    inventoryIsLimited: voucher.inventory_is_limited,
    imageCount: imageUrls.length
  });

  const token = await douyinTokenService.getToken();
  let response;
  try {
    response = await fetch(`${douyinConfig.openApiBaseUrl}/goodlife/v1/trip/hotel/savepresale/`, {
      method: 'POST',
      // 来客侧依靠该请求头识别总户，须与 Body account_id 保持一致，避免预售券归属到空账户。
      headers: {
        'Content-Type': 'application/json',
        'access-token': token,
        'Rpc-Transit-Life-Account': accountId
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('[Douyin Presale Voucher] 请求抖音失败:', {
      voucherId: voucher.id,
      outId: payload.presale_info.out_id,
      message: error.message
    });
    await repository.markSyncResult(id, { syncStatus: -1, auditMessage: '调用抖音预售券接口失败' });
    throw createServiceError('调用抖音预售券接口失败', 502);
  }

  const result = await response.json();
  const logId = getLogId(result);
  const errorMessage = result?.extra?.sub_description || result?.extra?.description || result?.data?.description;
  console.log('[Douyin Presale Voucher] 抖音响应:', {
    voucherId: voucher.id,
    httpStatus: response.status,
    errorCode: result?.data?.error_code ?? result?.extra?.error_code ?? null,
    douyinLogId: logId || null
  });
  if (!response.ok || Number(result?.extra?.error_code || 0) !== 0 || Number(result?.data?.error_code || 0) !== 0) {
    await repository.markSyncResult(id, { syncStatus: -1, logId, auditMessage: errorMessage || '抖音预售券同步失败' });
    console.warn('[Douyin Presale Voucher] 同步失败:', {
      voucherId: voucher.id,
      httpStatus: response.status,
      message: errorMessage || '抖音预售券同步失败',
      douyinLogId: logId || null
    });
    throw createServiceError(errorMessage || `抖音接口 HTTP ${response.status}`, 502, logId);
  }
  const douyinVoucherId = result?.data?.pre_sale_coupon_id;
  if (!douyinVoucherId) throw createServiceError('抖音同步成功但未返回 pre_sale_coupon_id', 502, logId);
  const syncedVoucher = await repository.markSyncResult(id, { douyinVoucherId, syncStatus: 1, logId, auditStatus: 'PENDING', auditMessage: null });
  console.log('[Douyin Presale Voucher] 同步成功:', {
    voucherId: voucher.id,
    douyinVoucherId,
    douyinLogId: logId || null
  });
  return syncedVoucher;
}

module.exports = { buildMarkupInfo, syncVoucher, updateVoucherProductStatus };
