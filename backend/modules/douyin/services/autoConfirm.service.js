const postgreDB = require('../../../database/postgreDB/pg')
const { confirmDouyinOrder } = require('./confirmOrder.service')

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
    confirmNumber,
  })

  const logId = result?.extra?.logid
  console.log('[autoConfirm] logId:', logId)

  const errorCode = result?.data?.error_code ?? result?.extra?.error_code ?? null

  if (errorCode === 0 || errorCode === null) {
    await postgreDB.query(
      `
      UPDATE douyin_orders
      SET confirm_status = 'confirmed',
          confirm_number = $2,
          confirmed_at = NOW(),
          updated_at = NOW()
      WHERE ota_order_id = $1
      `,
      [douyinOrder.ota_order_id, confirmNumber]
    )

    console.log('[autoConfirm] success:', douyinOrder.ota_order_id, confirmNumber, logId)

    return {
      action: 'confirmed',
      confirmNumber,
      result,
    }
  }

  await postgreDB.query(
    `
    UPDATE douyin_orders
    SET confirm_status = 'failed',
        updated_at = NOW()
    WHERE ota_order_id = $1
    `,
    [douyinOrder.ota_order_id]
  )
  console.error('[autoConfirm] failed:', douyinOrder.ota_order_id, confirmNumber, logId, result)

  return {
    action: 'failed',
    confirmNumber,
    result,
  }
}

module.exports = {
  autoConfirmDouyinOrder,
}
