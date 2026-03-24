const {
  DOUYIN_CONFIRM_RESULT_ACCEPT,
  DOUYIN_CONFIRM_RESULT_REJECT,
  confirmDouyinOrder,
  saveConfirmResultToLocalOrder,
} = require('../services/confirmOrder.service')

/**
 * 校验确认接单接口参数。
 *
 * @param {Object} body 请求体。
 * @returns {{valid:boolean, message:string}} 校验结果。
 */
function validateConfirmOrderBody(body = {}) {
  const otaOrderId = String(body.otaOrderId || '').trim()
  const confirmResult = Number(body.confirmResult)
  const confirmNumber = String(body.confirmNumber || '').trim()

  if (!otaOrderId) {
    return {
      valid: false,
      message: 'otaOrderId is required',
    }
  }

  if (![DOUYIN_CONFIRM_RESULT_ACCEPT, DOUYIN_CONFIRM_RESULT_REJECT].includes(confirmResult)) {
    return {
      valid: false,
      message: 'confirmResult must be 1 or 2',
    }
  }

  if (
    confirmResult === DOUYIN_CONFIRM_RESULT_ACCEPT &&
    !confirmNumber
  ) {
    return {
      valid: false,
      message: 'confirmNumber is required when confirmResult is 1',
    }
  }

  return {
    valid: true,
    message: '',
  }
}

async function confirmOrder(req, res) {
  try {
    const validation = validateConfirmOrderBody(req.body || {})

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      })
    }

    const {
      otaOrderId,
      confirmResult,
      confirmNumber,
      rejectCode,
      rejectReason,
    } = req.body

    const result = await confirmDouyinOrder({
      otaOrderId,
      confirmResult: Number(confirmResult),
      confirmNumber,
      rejectCode,
      rejectReason,
    })

    const localResult = await saveConfirmResultToLocalOrder({
      otaOrderId,
      confirmResult: Number(confirmResult),
      confirmNumber,
      result,
    })

    return res.json({
      success: true,
      action: localResult.action,
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
  validateConfirmOrderBody,
}
