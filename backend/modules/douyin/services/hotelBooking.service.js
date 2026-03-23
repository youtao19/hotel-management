const { mapDouyinBookingPayload } = require('../mappers/booking.mapper')
const {
  findByOtaOrderId,
  createDouyinOrder,
  updateDouyinOrderByOtaOrderId,
} = require('../repositories/douyinOrder.repository')

async function handleDouyinHotelBooking(payload = {}) {
  const mapped = mapDouyinBookingPayload(payload)

  if (!mapped.otaOrderId) {
    throw new Error('Missing otaOrderId(order_id) in Douyin payload')
  }

  const existingOrder = await findByOtaOrderId(mapped.otaOrderId)

  const orderToSave = {
    ...mapped,
    mappedPayload: mapped,
  }

  if (!existingOrder) {
    const created = await createDouyinOrder(orderToSave)

    return {
      action: 'created',
      order: created,
    }
  }

  const updated = await updateDouyinOrderByOtaOrderId(mapped.otaOrderId, orderToSave)

  return {
    action: 'updated',
    order: updated,
  }
}

module.exports = {
  handleDouyinHotelBooking,
}
