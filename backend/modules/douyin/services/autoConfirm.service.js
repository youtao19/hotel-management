const {
  DOUYIN_CONFIRM_RESULT_ACCEPT,
  confirmDouyinOrder,
  saveConfirmResultToLocalOrder,
} = require('./confirmOrder.service')

async function autoConfirmDouyinOrder(douyinOrder) {
  if (!douyinOrder || !douyinOrder.ota_order_id) {
    throw new Error('Missing ota_order_id in douyinOrder')
  }

  if (douyinOrder.confirm_status === 'confirmed') {
    return {
      action: 'skip',
      message: 'Order already confirmed',
      confirmNumber: douyinOrder.confirm_number || null,
    }
  }

  console.log('[autoConfirm] start:', douyinOrder.ota_order_id)
  const confirmNumber = `AUTO_${Date.now()}`
  const result = await confirmDouyinOrder({
    otaOrderId: douyinOrder.ota_order_id,
    confirmResult: DOUYIN_CONFIRM_RESULT_ACCEPT,
    confirmNumber,
  })

  const logId = result?.extra?.logid
  console.log('[autoConfirm] logId:', logId)
  const localResult = await saveConfirmResultToLocalOrder({
    otaOrderId: douyinOrder.ota_order_id,
    confirmResult: DOUYIN_CONFIRM_RESULT_ACCEPT,
    confirmNumber,
    result,
  })

  if (localResult.action === 'confirmed') {
    console.log('[autoConfirm] success:', douyinOrder.ota_order_id, confirmNumber, logId)
  } else {
    console.error('[autoConfirm] failed:', douyinOrder.ota_order_id, confirmNumber, logId, result)
  }

  return {
    action: localResult.action,
    confirmNumber,
    result,
  }
}

module.exports = {
  autoConfirmDouyinOrder,
}
