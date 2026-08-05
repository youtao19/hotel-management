const repository = require('./systemNotification.repository');
const presaleVoucherRepository = require('../douyin/presale-voucher/presaleVoucher.repository');

const AUDIT_EVENT = 'life_hotel_presale_audit_result';

/**
 * 将抖音预售券审核结果转换为后台可读通知，审核失败用 warning 便于运营优先处理。
 */
async function recordDouyinPresaleAuditNotification(msgId, payload) {
  const content = payload.content || {};
  const auditResult = Number(content.audit_result);
  const isApproved = auditResult === 1;
  const voucherId = content.out_id || content.id || '未知预售券';
  const auditMessage = String(content.audit_message || (isApproved ? '审核通过' : '审核未通过'));

  if (auditResult !== 1 && auditResult !== 2) {
    const error = new Error('预售券审核结果格式错误');
    error.statusCode = 400;
    throw error;
  }

  // 审核状态以抖音回调为准，避免仅有铃铛通知而运营无法在券列表判断是否可继续更新。
  await presaleVoucherRepository.markAuditResultByOutId(
    content.out_id,
    isApproved ? 'APPROVED' : 'REJECTED',
    auditMessage
  );

  const created = await repository.createNotification({
    source: 'DOUYIN',
    eventType: AUDIT_EVENT,
    externalMessageId: msgId,
    title: `抖音预售券审核${isApproved ? '通过' : '未通过'}`,
    content: `预售券：${voucherId}；${auditMessage}`,
    level: isApproved ? 'positive' : 'warning',
    rawPayload: payload
  });

  return {
    created: Boolean(created),
    voucherId,
    auditResult
  };
}

/**
 * 返回顶部铃铛所需的最近通知和未读数量。
 */
async function getNotifications() {
  return repository.listNotifications(20);
}

/**
 * 标记全局通知已读，避免同一审核结果持续占用未读提示。
 */
async function markAllAsRead() {
  await repository.markAllAsRead();
}

module.exports = {
  AUDIT_EVENT,
  getNotifications,
  markAllAsRead,
  recordDouyinPresaleAuditNotification
};
