const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')

async function confirmDouyinOrder({
  otaOrderId,
  confirmNumber,
}) {
  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/trade/hotel/order/confirm/',
    withAccountId: true,
    data: {
      order_id: otaOrderId,
      confirm_result: {
        confirm_result: 1, // 1=接单，2=拒单
        confirm_number: confirmNumber,
      },
    },
  })

  return result
}

module.exports = {
  confirmDouyinOrder,
}
