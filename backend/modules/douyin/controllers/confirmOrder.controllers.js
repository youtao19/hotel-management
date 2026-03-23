const { confirmDouyinOrder } = require('../services/confirmOrder.service')

async function confirmOrder(req, res) {
  try {
    const { otaOrderId, confirmNumber } = req.body

    const result = await confirmDouyinOrder({
      otaOrderId,
      confirmNumber,
    })

    return res.json({
      success: true,
      result,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

module.exports = {
  confirmOrder,
}
