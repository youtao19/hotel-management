"use strict";

const crypto = require('crypto');
const repository = require('./presaleOrder.repository');
const bookableCheckService = require('../availability/bookableCheck.service');

/** 创建抖音预售订单业务错误。 */
function createOrderError(message, errorCode) {
  const error = new Error(message);
  error.douyinErrorCode = errorCode;
  return error;
}

/** 将抖音金额字段规范为整数分。 */
function toCents(value, fieldName) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) throw createOrderError(`${fieldName} 格式错误`, 13);
  return amount;
}

/** 校验并整理抖音预售创单请求。 */
function normalizePayload(payload = {}) {
  const orderId = String(payload.order_id || '').trim();
  const voucherId = String(payload.pre_sale_coupon_id || '').trim();
  const voucherCount = Number(payload.total_coupon_count);
  const eachCouponAmount = toCents(payload.each_coupon_amount, 'each_coupon_amount');
  const totalAmount = toCents(payload.total_amount, 'total_amount');
  const bizType = Number(payload.biz_type);
  if (!orderId || !voucherId || !Number.isInteger(voucherCount) || voucherCount <= 0 || bizType !== 2011) {
    throw createOrderError('预售订单请求参数不合法', 13);
  }
  if (totalAmount !== eachCouponAmount * voucherCount) throw createOrderError('订单金额与券数量不一致', 8);
  const ratePlanId = String(payload.rate_plan_id || '').trim();
  const checkInDate = String(payload.check_in_date || '').trim();
  const checkOutDate = String(payload.check_out_date || '').trim();
  const paymentInfo = payload.pay_info;
  if ((checkInDate || checkOutDate) && (!ratePlanId || !checkInDate || !checkOutDate)) {
    throw createOrderError('预约信息不完整', 5);
  }
  if (paymentInfo !== undefined && (!paymentInfo || typeof paymentInfo !== 'object' || Array.isArray(paymentInfo))) {
    throw createOrderError('pay_info 格式错误', 13);
  }
  return { orderId, voucherId, voucherCount, eachCouponAmount, totalAmount, bizType, ratePlanId, checkInDate, checkOutDate, paymentInfo: paymentInfo || null };
}

/** 按抖音旧版本地解密 SDK 将 client_secret 对齐为 32 位。 */
function normalizeClientSecret(secret) {
  let normalized = String(secret || '');
  if (normalized.length > 32) {
    const difference = normalized.length - 32;
    const rightCount = Math.floor(difference / 2);
    const leftCount = difference - rightCount;
    normalized = normalized.slice(leftCount, normalized.length - rightCount);
  }
  if (normalized.length < 32) {
    const difference = 32 - normalized.length;
    const rightCount = Math.floor(difference / 2);
    const leftCount = difference - rightCount;
    normalized = `${'#'.repeat(leftCount)}${normalized}${'#'.repeat(rightCount)}`;
  }
  return normalized;
}

/** 使用抖音旧版本地 AES-256-CBC 规则解密敏感字段。 */
function decryptValue(value) {
  const encrypted = String(value || '').trim();
  if (!encrypted) return '';
  if (encrypted.startsWith('Enc.')) {
    throw createOrderError('联系人信息为 Enc. 密文，本地解密不支持', 6);
  }
  const secret = String(process.env.DOUYIN_CLIENT_SECRET || '');
  if (!secret) throw createOrderError('未配置抖音 client_secret，无法解密联系人信息', 13);
  const key = normalizeClientSecret(secret);
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(key.slice(-16), 'utf8'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
  } catch (error) {
    throw createOrderError('联系人信息解密失败', 6);
  }
}

/** 从抖音联系人字段中提取并规范中国大陆手机号。 */
function normalizeMobile(value) {
  let mobile = String(value || '').trim();
  if (!mobile) return '';

  // 部分加密组件会将原始手机号序列化为 JSON 字符串或对象。
  try {
    const parsed = JSON.parse(mobile);
    if (typeof parsed === 'string') mobile = parsed;
    if (parsed && typeof parsed === 'object') mobile = parsed.phone || parsed.mobile || parsed.phone_number || '';
  } catch (_error) {
    // 非 JSON 内容按普通手机号文本继续处理。
  }

  mobile = String(mobile).trim().replace(/[\s-]/g, '');
  return mobile.replace(/^\+?86/, '');
}

/** 兼容官方示例中的明文手机号，生产密文则按规范解密。 */
function resolveContact(payload = {}) {
  const contact = payload.contact_info || {};
  const rawPhone = String(contact.phone || contact.mobile || contact.phone_number || '').trim();
  const rawName = String(contact.name || '').trim();
  const plainPhone = normalizeMobile(rawPhone);
  const phone = !rawPhone
    ? ''
    : /^1\d{10}$/.test(plainPhone)
      ? plainPhone
      : normalizeMobile(decryptValue(rawPhone));
  const name = rawName && !/^[\u4e00-\u9fa5A-Za-z .·-]{1,64}$/.test(rawName) ? decryptValue(rawName) : rawName;
  // 官方将电话定义为选填；仅在实际传入时校验其格式。
  if (phone && !/^1\d{10}$/.test(phone)) throw createOrderError('联系人手机号格式错误', 6);
  return { name, phone };
}

/** 校验带预约日期的预售订单是否仍可订。 */
async function assertBookable(order) {
  if (!order.ratePlanId) return;
  const result = await bookableCheckService.buildBookableCheckResponse({
    rate_plan_id: order.ratePlanId,
    biz_type: 2011,
    check_in_date: order.checkInDate,
    check_out_date: order.checkOutDate,
    number_of_units: order.voucherCount,
    total_amount: order.totalAmount
  });
  if (Number(result.error_code) !== 0) throw createOrderError(result.description || '预售券不可订', Number(result.error_code) || 13);
}

/** 创建或返回已存在的抖音预售订单。 */
async function createOrder(payload, options = {}) {
  const order = normalizePayload(payload);
  const existing = await repository.findByDouyinOrderId(order.orderId);
  if (existing) return { douyinOrderId: order.orderId, localOrderId: existing.order_id, duplicate: true };
  const voucher = await repository.findVoucherByDouyinId(order.voucherId);
  if (!voucher) throw createOrderError('预售券不存在或已失效', 1);
  await assertBookable(order);
  const contact = resolveContact(payload);
  const localOrderId = `DYPS${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  try {
    // 支付后创单不会再收到支付通知，必须在创单时确认已付款。
    const orderStage = order.paymentInfo ? 'PAID' : 'CREATED';
    const created = await repository.insertOrder({
      localOrderId,
      douyinOrderId: order.orderId,
      accountId: options.accountId || '',
      orderStage,
      voucherId: order.voucherId,
      voucherCount: order.voucherCount,
      eachCouponAmount: order.eachCouponAmount,
      totalAmount: order.totalAmount,
      bizType: order.bizType,
      ratePlanId: order.ratePlanId || null,
      checkInDate: order.checkInDate || null,
      checkOutDate: order.checkOutDate || null,
      contactName: contact.name || null,
      contactPhone: contact.phone || null,
      currency: String(payload.currency || 'CNY'),
      logId: options.logId || null,
      rawPayload: payload,
      mappedPayload: {
        voucherLocalId: voucher.id,
        contactName: contact.name || '',
        contactPhone: contact.phone,
        paymentInfo: order.paymentInfo ? { payTimeUnix: order.paymentInfo.pay_time_unix ?? null } : null
      }
    });
    return { douyinOrderId: created.ota_order_id, localOrderId: created.order_id, duplicate: false };
  } catch (error) {
    if (error.code === '23505') {
      const duplicated = await repository.findByDouyinOrderId(order.orderId);
      if (duplicated) return { douyinOrderId: order.orderId, localOrderId: duplicated.order_id, duplicate: true };
    }
    throw error;
  }
}

module.exports = { createOrder, decryptValue, normalizeClientSecret, normalizeMobile, normalizePayload, resolveContact };
