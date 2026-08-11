"use strict";

const express = require('express');
const Ajv = require('ajv');
const repository = require('./presaleVoucher.repository');
const service = require('./presaleVoucher.service');

const router = express.Router();
const ajv = new Ajv({ allErrors: true });
const datePattern = '^\\d{4}-\\d{2}-\\d{2}$';
const dateTimePattern = '^\\d{4}-\\d{2}-\\d{2} [0-2]\\d:[0-5]\\d$';
const beijingDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});
const voucherSchema = {
  type: 'object',
  required: ['ratePlanId', 'name', 'originalAmount', 'actualAmount', 'inventoryIsLimited', 'eachPersonMax', 'eachPersonEachOrderMax', 'saleStartAt', 'saleEndAt', 'bookStartDate', 'bookEndDate', 'imageUrls'],
  properties: {
    ratePlanId: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    originalAmount: { type: 'number', minimum: 0 },
    actualAmount: { type: 'number', minimum: 0 },
    inventoryIsLimited: { type: 'boolean' },
    inventoryCount: { type: 'integer', minimum: 0 },
    eachPersonMax: { type: 'integer', minimum: 1 },
    eachPersonEachOrderMax: { type: 'integer', minimum: 1 },
    cancelBookingType: { type: 'integer', enum: [1, 3] },
    saleStartAt: { type: 'string', pattern: dateTimePattern },
    saleEndAt: { type: 'string', pattern: dateTimePattern },
    bookStartDate: { type: 'string', pattern: datePattern },
    bookEndDate: { type: 'string', pattern: datePattern },
    imageUrls: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
  },
  additionalProperties: false
};
const validateVoucher = ajv.compile(voucherSchema);

/** 只接受正整数主键，避免把路径字符串直接交给数据库。 */
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** 为旧调用方补齐默认的不可取消规则，避免更新时覆盖已有选择。 */
function normalizeVoucherPayload(payload = {}, defaultCancelBookingType = 3) {
  return {
    ...payload,
    cancelBookingType: payload.cancelBookingType === undefined ? defaultCancelBookingType : payload.cancelBookingType
  };
}

/** 将指定时刻格式化为北京时间的售卖时间字段格式。 */
function formatBeijingDateTime(date = new Date()) {
  const parts = beijingDateTimeFormatter.formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** 返回新增预售券可直接使用的北京时间售卖开始时间。 */
function getDefaultSaleStartAt(now = new Date()) {
  return formatBeijingDateTime(new Date(now.getTime() + 2 * 60 * 1000));
}

/** 聚合跨字段业务校验，前端提示不能替代这里的接口边界保护。 */
function validatePayload(payload, requireFutureSaleStart = false) {
  if (!validateVoucher(payload)) {
    const details = (validateVoucher.errors || []).map(error => `${error.instancePath || '请求体'} ${error.message}`).join('；');
    console.warn('[Douyin Presale Voucher] 请求校验失败:', { details });
    return `请求数据格式错误：${details}`;
  }
  const invalidImage = payload.imageUrls.find(imageUrl => !isSupportedImageSource(imageUrl));
  if (invalidImage) return '图片必须是抖音可访问的 http/https URL';
  if (!payload.inventoryIsLimited && payload.inventoryCount !== undefined) return '不限库存时不能填写库存数量';
  if (payload.inventoryIsLimited && payload.inventoryCount === undefined) return '有限库存必须填写库存数量';
  if (payload.eachPersonEachOrderMax > payload.eachPersonMax) return '单笔限购不能大于单用户累计限购';
  if (payload.originalAmount < payload.actualAmount) return '划线价不能低于实际售价';
  // 以服务端北京时间为准，避免浏览器时间偏差导致抖音拒绝过期售卖时间。
  if (requireFutureSaleStart) {
    const currentBeijingTime = formatBeijingDateTime();
    if (payload.saleStartAt <= currentBeijingTime) return `售卖开始时间必须晚于当前北京时间 ${currentBeijingTime}`;
  }
  if (payload.saleEndAt <= payload.saleStartAt) return '售卖结束时间必须晚于开始时间';
  if (payload.bookEndDate < payload.bookStartDate) return '可预约结束日期不能早于开始日期';
  return null;
}

/** 抖音仅接受可公开访问的图片 URL，提交前拦截 Base64 可避免产生无效同步记录。 */
function isSupportedImageSource(imageUrl) {
  return /^https?:\/\//i.test(imageUrl) && imageUrl.length <= 2048;
}

/** 保存和更新均走同一同步出口，确保响应始终返回抖音最新券ID与状态。 */
async function syncAndRespond(res, id) {
  const voucher = await service.syncVoucher(id);
  return res.status(200).json({ data: voucher, message: '预售券已同步到抖音，等待审核结果' });
}

/** 抖音业务失败携带 logid 时直接回显原因，运营可据此完成商家授权或向抖音排障。 */
function sendSyncError(res, error, voucherId = null) {
  const statusCode = error.statusCode || 500;
  const douyinLogId = error.douyinLogId || null;
  const message = douyinLogId
    ? `${error.message}（抖音日志ID：${douyinLogId}）`
    : statusCode >= 500 ? '同步预售券到抖音失败' : error.message;
  return res.status(statusCode).json({ message, error: error.message, douyin_log_id: douyinLogId, voucher_id: voucherId });
}

router.get('/', async (req, res) => {
  try {
    res.json({ data: await repository.list(), message: '预售券列表获取成功' });
  } catch (error) {
    res.status(500).json({ message: '获取预售券列表失败', error: error.message });
  }
});

/** 返回新增预售券的服务器时间默认值，前端不自行推算北京时间。 */
router.get('/sale-time-default', (req, res) => {
  return res.json({ data: { saleStartAt: getDefaultSaleStartAt() } });
});

router.post('/', async (req, res) => {
  const payload = normalizeVoucherPayload(req.body || {});
  const message = validatePayload(payload, true);
  if (message) return res.status(400).json({ message });
  let voucher;
  try {
    voucher = await repository.create(payload);
    return await syncAndRespond(res, voucher.id);
  } catch (error) {
    // 本地草稿已创建时返回其 ID，前端重试必须改走更新接口。
    return sendSyncError(res, error, voucher?.id || null);
  }
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: '预售券ID格式错误' });
  try {
    const existing = await repository.findById(id);
    if (!existing) return res.status(404).json({ message: '预售券不存在' });
    const payload = normalizeVoucherPayload(req.body || {}, existing.cancel_booking_type);
    const message = validatePayload(payload);
    if (message) return res.status(400).json({ message });
    if (existing.rate_plan_id !== payload.ratePlanId) {
      return res.status(400).json({ message: '预售券创建后不能更换绑定套餐，请新建预售券' });
    }
    await repository.update(id, payload);
    return await syncAndRespond(res, id);
  } catch (error) {
    return sendSyncError(res, error);
  }
});

/** 调用抖音商品状态接口上架或下架预售券。 */
router.patch('/:id/product-status', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: '预售券ID格式错误' });
  try {
    const result = await service.updateVoucherProductStatus(id, req.body?.operation);
    const message = result.operation === 'ONLINE' ? '预售券已上线' : '预售券已下线';
    return res.status(200).json({ data: result.voucher, message, douyin_log_id: result.logId || null });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const douyinLogId = error.douyinLogId || null;
    const message = douyinLogId ? `${error.message}（抖音日志ID：${douyinLogId}）` : error.message;
    return res.status(statusCode).json({ message, error: error.message, douyin_log_id: douyinLogId });
  }
});

module.exports = router;
